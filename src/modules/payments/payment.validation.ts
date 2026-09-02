import { z } from "zod";

export const mockPaymentSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  success: z.boolean().default(true), // Simulate success or failure
});

export type MockPaymentInput = z.infer<typeof mockPaymentSchema>;
