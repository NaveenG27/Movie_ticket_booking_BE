import { Server } from "socket.io";
import prisma from "../config/db";
import { setWithTTL, deleteKey, getValue } from "../config/redis";

/**
 * Seat Locking via Socket.io + Redis
 * ─────────────────────────────────────
 * Flow:
 *   1. Client joins room `show:${showId}`
 *   2. Client emits `lock_seat` with { showId, seatId }
 *   3. Server checks Redis + Postgres, sets lock with 5-min TTL
 *   4. Client emits `unlock_seat` to release
 *   5. On TTL expiry, Redis keyspace notification reverts the seat
 *   6. On booking confirmation, locks are cleared in the DB transaction
 *
 * Redis key format: lock:show:{showId}:seat:{seatId}
 * Redis value: userId of the lock holder
 * TTL: 300 seconds (5 minutes)
 */

const LOCK_TTL_SECONDS = 300;

const seatLockKey = (showId: string, seatId: string) =>
  `lock:show:${showId}:seat:${seatId}`;

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function registerSeatLockingHandlers(io: Server): void {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log(`🔌 Seat locking: client connected ${socket.id}`);

    // ─── LOCK SEAT ──────────────────────────────────────────
    socket.on(
      "lock_seat",
      async ({ showId, seatId }: { showId: string; seatId: string }) => {
        try {
          const userId = (socket.handshake.auth as any)?.userId
            || (socket.handshake.query as any)?.userId;

          if (!userId) {
            socket.emit("lock_failed", {
              seatId,
              reason: "Authentication required",
            });
            return;
          }

          // Check Redis first (fast path)
          const existingLock = await getValue(seatLockKey(showId, seatId));

          if (existingLock) {
            socket.emit("lock_failed", {
              seatId,
              reason: "Seat is already locked by another user",
            });
            return;
          }

          // Verify seat is AVAILABLE in Postgres
          const showSeat = await prisma.showSeat.findUnique({
            where: { showId_seatId: { showId, seatId } },
          });

          if (!showSeat) {
            socket.emit("lock_failed", {
              seatId,
              reason: "Seat not found for this show",
            });
            return;
          }

          if (showSeat.status !== "AVAILABLE") {
            socket.emit("lock_failed", {
              seatId,
              reason: `Seat is ${showSeat.status.toLowerCase()}`,
            });
            return;
          }

          // Double-check Redis after DB check (race condition guard)
          const recheck = await getValue(seatLockKey(showId, seatId));
          if (recheck) {
            socket.emit("lock_failed", {
              seatId,
              reason: "Seat was just locked by someone else",
            });
            return;
          }

          // Set Redis lock with TTL
          await setWithTTL(
            seatLockKey(showId, seatId),
            userId,
            LOCK_TTL_SECONDS
          );

          // Update Postgres ShowSeat status to LOCKED
          await prisma.showSeat.update({
            where: { showId_seatId: { showId, seatId } },
            data: { status: "LOCKED", lockedBy: userId },
          });

          // Broadcast to ALL clients in the room (including the locker)
          io.to(`show:${showId}`).emit("seat_locked", {
            seatId,
            showId,
            lockedBy: userId,
            expiresAt: new Date(Date.now() + LOCK_TTL_SECONDS * 1000).toISOString(),
          });

          console.log(`🔒 Seat ${seatId} locked by user ${userId} for show ${showId}`);
        } catch (err) {
          console.error("Error locking seat:", err);
          socket.emit("lock_failed", { seatId, reason: "Internal server error" });
        }
      }
    );

    // ─── UNLOCK SEAT ────────────────────────────────────────
    socket.on(
      "unlock_seat",
      async ({ showId, seatId }: { showId: string; seatId: string }) => {
        try {
          const userId = (socket.handshake.auth as any)?.userId
            || (socket.handshake.query as any)?.userId;

          if (!userId) {
            socket.emit("unlock_failed", { seatId, reason: "Authentication required" });
            return;
          }

          // Check that this user holds the lock
          const lockHolder = await getValue(seatLockKey(showId, seatId));

          if (lockHolder && lockHolder !== userId) {
            socket.emit("unlock_failed", {
              seatId,
              reason: "You don't hold the lock on this seat",
            });
            return;
          }

          // Delete Redis key
          await deleteKey(seatLockKey(showId, seatId));

          // Revert ShowSeat status to AVAILABLE in Postgres
          await prisma.showSeat.updateMany({
            where: {
              showId,
              seatId,
              status: "LOCKED",
              lockedBy: userId,
            },
            data: { status: "AVAILABLE", lockedBy: null },
          });

          // Broadcast to room
          io.to(`show:${showId}`).emit("seat_released", {
            seatId,
            showId,
            reason: "user_unlocked",
          });

          console.log(`🔓 Seat ${seatId} released by user ${userId} for show ${showId}`);
        } catch (err) {
          console.error("Error unlocking seat:", err);
          socket.emit("unlock_failed", { seatId, reason: "Internal server error" });
        }
      }
    );
  });
}

export default registerSeatLockingHandlers;
