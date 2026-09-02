import { Router } from "express";
import {
  initiateBooking,
  confirmBooking,
  cancelBooking,
  getMyBookings,
  getBookingById,
} from "./booking.controller";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { initiateBookingSchema } from "./booking.validation";

const router = Router();

// All booking routes require authentication
router.use(authenticate);

// Customer: view own bookings
router.get("/my", getMyBookings);

// Any authenticated user: view a specific booking
router.get("/:id", getBookingById);

// Customer: initiate a booking (after seat lock)
router.post(
  "/",
  authorize("CUSTOMER", "ADMIN"),
  validate(initiateBookingSchema),
  initiateBooking
);

// Customer: confirm booking (after mock payment)
router.post(
  "/:id/confirm",
  authorize("CUSTOMER", "ADMIN"),
  confirmBooking
);

// Customer: cancel booking
router.post(
  "/:id/cancel",
  authorize("CUSTOMER", "ADMIN"),
  cancelBooking
);

export default router;
