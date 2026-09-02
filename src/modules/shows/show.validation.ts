import { z } from "zod";

export const createShowSchema = z.object({
  movieId: z.string().uuid("Invalid movie ID"),
  screenId: z.string().uuid("Invalid screen ID"),
  startTime: z.string().datetime("Invalid start time (use ISO 8601)"),
  endTime: z.string().datetime("Invalid end time (use ISO 8601)"),
  basePrice: z.number().positive("Base price must be positive"),
});

export const updateShowSchema = createShowSchema.partial();

export type CreateShowInput = z.infer<typeof createShowSchema>;
export type UpdateShowInput = z.infer<typeof updateShowSchema>;
