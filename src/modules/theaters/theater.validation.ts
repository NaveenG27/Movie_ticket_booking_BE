import { z } from "zod";

export const createTheaterSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  city: z.string().min(1, "City is required").max(100),
});

export const updateTheaterSchema = createTheaterSchema.partial();

export type CreateTheaterInput = z.infer<typeof createTheaterSchema>;
export type UpdateTheaterInput = z.infer<typeof updateTheaterSchema>;
