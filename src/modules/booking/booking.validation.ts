import { z } from "zod";

export const initiateBookingSchema = z.object({
  showId: z.string().uuid("Invalid show ID"),
  seatIds: z
    .array(z.string().uuid("Invalid seat ID"))
    .min(1, "Select at least one seat")
    .max(10, "Cannot book more than 10 seats at once"),
});

export type InitiateBookingInput = z.infer<typeof initiateBookingSchema>;
