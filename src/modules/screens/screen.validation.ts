import { z } from "zod";

export const createScreenSchema = z.object({
  name: z.string().min(1, "Screen name is required").max(100),
  totalSeats: z.number().int().positive("Total seats must be positive"),
});

export const updateScreenSchema = createScreenSchema.partial();

export type CreateScreenInput = z.infer<typeof createScreenSchema>;
export type UpdateScreenInput = z.infer<typeof updateScreenSchema>;
