import { Request, Response, NextFunction } from "express";
import * as bookingService from "./booking.service";
import { JwtPayload } from "../../middleware/auth";

export async function initiateBooking(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as JwtPayload;
    const booking = await bookingService.initiateBooking(req.body, user.userId);

    res.status(201).json({
      success: true,
      message: "Booking initiated. Complete payment to confirm.",
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmBooking(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as JwtPayload;
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "paymentId is required (from mock payment)",
      });
    }

    const booking = await bookingService.confirmBooking(
      req.params.id,
      user.userId,
      paymentId
    );

    // Broadcast seat_booked to the show room via Socket.io
    const { getIO } = await import("../../sockets/seatLocking");
    const io = getIO();
    if (io) {
      // Get showId from the booking
      const showId = booking.bookingSeats[0]?.showSeat.showId;
      if (showId) {
        io.to(`show:${showId}`).emit("seat_booked", {
          bookingId: booking.id,
          seatIds: booking.bookingSeats.map((bs: any) => bs.showSeat.seatId),
          showId,
        });
      }
    }

    res.json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelBooking(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as JwtPayload;
    const booking = await bookingService.cancelBooking(
      req.params.id,
      user.userId
    );

    // Broadcast seat_released for cancelled bookings
    const { getIO } = await import("../../sockets/seatLocking");
    const io = getIO();
    if (io) {
      // Get the show and released seats from the booking context
      const fullBooking = await bookingService.getBookingById(
        req.params.id,
        user.userId,
        user.role
      );
      const showId = fullBooking.showId;
      const seatIds = fullBooking.bookingSeats.map(
        (bs: any) => bs.showSeat.seatId
      );

      io.to(`show:${showId}`).emit("seat_released", {
        showId,
        seatIds,
        reason: "booking_cancelled",
      });
    }

    res.json({
      success: true,
      message: "Booking cancelled",
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyBookings(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as JwtPayload;
    const bookings = await bookingService.getMyBookings(user.userId);
    res.json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
}

export async function getBookingById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user as JwtPayload;
    const booking = await bookingService.getBookingById(
      req.params.id,
      user.userId,
      user.role
    );
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}
