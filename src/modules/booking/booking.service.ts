import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import prisma from "../../config/db";
import { redis, getValue, deleteKey } from "../../config/redis";
import { AppError } from "../../utils/AppError";
import { InitiateBookingInput } from "./booking.validation";

// Redis key patterns
const seatLockKey = (showId: string, seatId: string) =>
  `lock:show:${showId}:seat:${seatId}`;

const LOCK_TTL_SECONDS = 300; // 5 minutes

// ─── Initiate Booking ──────────────────────────────────────
// Creates a PENDING booking after verifying Redis locks are held
// by this user for the requested seats.

export async function initiateBooking(
  data: InitiateBookingInput,
  userId: string
) {
  const { showId, seatIds } = data;

  // 1. Verify the show exists
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) throw AppError.notFound("Show not found");

  // 2. Verify all requested seats are locked by THIS user in Redis
  for (const seatId of seatIds) {
    const lockHolder = await getValue(seatLockKey(showId, seatId));
    if (!lockHolder) {
      throw AppError.badRequest(
        `Seat ${seatId} is not locked. Lock it first via Socket.io`
      );
    }
    if (lockHolder !== userId) {
      throw AppError.conflict(
        `Seat ${seatId} is locked by another user`
      );
    }
  }

  // 3. Fetch ShowSeat rows and verify they are LOCKED by this user
  const showSeats = await prisma.showSeat.findMany({
    where: {
      showId,
      seatId: { in: seatIds },
    },
    include: { seat: { select: { row: true, number: true, seatType: true } } },
  });

  if (showSeats.length !== seatIds.length) {
    throw AppError.badRequest("One or more selected seats are invalid");
  }

  // Verify each is LOCKED by this user at the DB level too
  for (const ss of showSeats) {
    if (ss.status !== "LOCKED" || ss.lockedBy !== userId) {
      throw AppError.conflict(
        `Seat ${ss.seat.row}${ss.seat.number} is not locked by you`
      );
    }
  }

  // 4. Calculate total amount
  const totalAmount = showSeats.reduce(
    (sum, ss) => sum + Number(ss.price),
    0
  );

  // 5. Create a PENDING booking with BookingSeat rows
  const booking = await prisma.booking.create({
    data: {
      userId,
      showId,
      totalAmount,
      status: "PENDING",
      bookingSeats: {
        create: showSeats.map((ss) => ({
          showSeatId: ss.id,
        })),
      },
    },
    include: {
      bookingSeats: {
        include: {
          showSeat: {
            include: { seat: true },
          },
        },
      },
    },
  });

  return booking;
}

// ─── Confirm Booking ───────────────────────────────────────
// After mock payment success, finalize the booking.
//
// CRITICAL: Even though Redis holds a lock, two simultaneous
// confirmation requests could race past the Redis check. We use
// SELECT ... FOR UPDATE on the ShowSeat rows inside a Postgres
// transaction to guarantee that only one confirmation succeeds.
//
// This is the classic "double-checked locking" pattern:
//   1. Redis lock prevents MOST concurrent attempts (fast path)
//   2. DB-level row lock prevents the RARE race condition (safety net)

export async function confirmBooking(
  bookingId: string,
  userId: string,
  paymentId: string
) {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch the booking
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { bookingSeats: true },
    });

    if (!booking) throw AppError.notFound("Booking not found");
    if (booking.userId !== userId) {
      throw AppError.forbidden("You can only confirm your own bookings");
    }
    if (booking.status !== "PENDING") {
      throw AppError.badRequest(
        `Booking is already ${booking.status.toLowerCase()}`
      );
    }

    // 2. Lock all ShowSeat rows with FOR UPDATE to prevent race conditions.
    //    If two transactions try to confirm the same seat simultaneously,
    //    the second one will BLOCK on this SELECT until the first commits
    //    or rolls back. When it unblocks, it will see the updated status
    //    and fail the check below, rolling back its own transaction.
    const showSeatIds = booking.bookingSeats.map((bs) => bs.showSeatId);

    const lockedShowSeats = await tx.$queryRaw<any[]>(
      Prisma.sql`
        SELECT ss.id, ss.status, ss."lockedBy"
        FROM "ShowSeat" ss
        WHERE ss.id IN (${Prisma.join(showSeatIds)})
        FOR UPDATE
      `
    );

    // 3. Verify all seats are still LOCKED by this user
    for (const ss of lockedShowSeats) {
      if (ss.status !== "LOCKED" || ss.lockedBy !== userId) {
        // Release the Redis locks for seats that can't be booked
        for (const seatId of showSeatIds) {
          await deleteKey(seatLockKey(booking.showId, seatId));
        }
        throw AppError.conflict(
          "One or more seats are no longer available for booking"
        );
      }
    }

    // 4. Update ShowSeat status to BOOKED
    await tx.showSeat.updateMany({
      where: { id: { in: showSeatIds } },
      data: { status: "BOOKED", lockedBy: null },
    });

    // 5. Confirm the booking
    const confirmedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
      include: {
        bookingSeats: {
          include: {
            showSeat: {
              include: { seat: true },
            },
          },
        },
        payments: true,
      },
    });

    // 6. Create payment record
    await tx.payment.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        status: "SUCCESS",
        providerTxnId: paymentId,
      },
    });

    // 7. Clean up Redis locks
    for (const seatId of showSeatIds) {
      await deleteKey(seatLockKey(booking.showId, seatId));
    }

    return confirmedBooking;
  });
}

// ─── Cancel Booking ────────────────────────────────────────

export async function cancelBooking(bookingId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { bookingSeats: { include: { showSeat: true } } },
    });

    if (!booking) throw AppError.notFound("Booking not found");
    if (booking.userId !== userId) {
      throw AppError.forbidden("You can only cancel your own bookings");
    }
    if (booking.status === "CANCELLED") {
      throw AppError.badRequest("Booking is already cancelled");
    }

    // If CONFIRMED, release the seats back to AVAILABLE
    if (booking.status === "CONFIRMED") {
      const showSeatIds = booking.bookingSeats.map((bs) => bs.showSeatId);

      await tx.showSeat.updateMany({
        where: { id: { in: showSeatIds } },
        data: { status: "AVAILABLE" },
      });

      // Update payment status to FAILED (refund simulation)
      await tx.payment.updateMany({
        where: { bookingId, status: "SUCCESS" },
        data: { status: "FAILED" },
      });
    }

    // If PENDING with locked seats, release those too
    if (booking.status === "PENDING") {
      const showSeatIds = booking.bookingSeats.map((bs) => bs.showSeatId);

      await tx.showSeat.updateMany({
        where: { id: { in: showSeatIds }, status: "LOCKED" },
        data: { status: "AVAILABLE", lockedBy: null },
      });

      // Release Redis locks
      for (const seatId of showSeatIds) {
        await deleteKey(seatLockKey(booking.showId, seatId));
      }
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    });
  });
}

// ─── Get My Bookings ──────────────────────────────────────

export async function getMyBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    include: {
      show: {
        include: {
          movie: { select: { id: true, title: true, posterUrl: true } },
          screen: {
            select: {
              id: true,
              name: true,
              theater: { select: { id: true, name: true, city: true } },
            },
          },
        },
      },
      bookingSeats: {
        include: {
          showSeat: {
            include: { seat: true },
          },
        },
      },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Get Booking By ID ────────────────────────────────────

export async function getBookingById(bookingId: string, userId: string, role: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      show: {
        include: {
          movie: true,
          screen: {
            include: {
              theater: true,
            },
          },
        },
      },
      bookingSeats: {
        include: {
          showSeat: {
            include: { seat: true },
          },
        },
      },
      payments: true,
    },
  });

  if (!booking) throw AppError.notFound("Booking not found");

  // Customers can only see their own bookings
  if (role === "CUSTOMER" && booking.userId !== userId) {
    throw AppError.forbidden("You can only view your own bookings");
  }

  return booking;
}

// ─── Handle Expired Lock (called from Redis keyspace listener) ──

export async function handleExpiredLock(redisKey: string) {
  // Parse: lock:show:${showId}:seat:${seatId}
  const parts = redisKey.split(":");
  if (parts.length !== 5) return;

  const showId = parts[2];
  const seatId = parts[4];

  try {
    // Find the ShowSeat and revert to AVAILABLE if still LOCKED
    const showSeat = await prisma.showSeat.findUnique({
      where: { showId_seatId: { showId, seatId } },
    });

    if (showSeat && showSeat.status === "LOCKED") {
      await prisma.showSeat.update({
        where: { id: showSeat.id },
        data: { status: "AVAILABLE", lockedBy: null },
      });

      // Broadcast seat_released to the show room
      // (imported lazily to avoid circular dependency)
      const { getIO } = await import("../../sockets/seatLocking");
      const io = getIO();
      if (io) {
        io.to(`show:${showId}`).emit("seat_released", {
          seatId,
          showId,
          reason: "lock_expired",
        });
      }
    }
  } catch (err) {
    console.error("Error handling expired lock:", err);
  }
}
