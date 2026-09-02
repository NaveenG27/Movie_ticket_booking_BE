import { v4 as uuidv4 } from "uuid";
import prisma from "../../config/db";
import { AppError } from "../../utils/AppError";

/**
 * Simulates a payment gateway call.
 * In a real system, this would call Stripe, Razorpay, etc.
 * Here we just generate a fake transaction ID and return success/failure.
 */
export async function processMockPayment(
  bookingId: string,
  userId: string,
  shouldSucceed: boolean
) {
  // Verify the booking exists and belongs to the user
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) throw AppError.notFound("Booking not found");
  if (booking.userId !== userId) {
    throw AppError.forbidden("You can only pay for your own bookings");
  }

  if (booking.status !== "PENDING") {
    throw AppError.badRequest(
      `Booking is already ${booking.status.toLowerCase()}, cannot process payment`
    );
  }

  // Generate a mock transaction ID
  const providerTxnId = `mock_txn_${uuidv4()}`;

  if (shouldSucceed) {
    // Record successful payment
    await prisma.payment.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        status: "SUCCESS",
        providerTxnId,
      },
    });

    return {
      success: true,
      providerTxnId,
      message: "Payment processed successfully",
      bookingId,
    };
  } else {
    // Record failed payment
    await prisma.payment.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        status: "FAILED",
        providerTxnId,
      },
    });

    return {
      success: false,
      providerTxnId,
      message: "Payment failed (simulated)",
      bookingId,
    };
  }
}
