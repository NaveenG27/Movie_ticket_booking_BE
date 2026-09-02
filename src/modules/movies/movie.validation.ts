import { z } from "zod";

export const createMovieSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  durationMin: z.number().int().positive("Duration must be positive"),
  language: z.string().min(1, "Language is required"),
  genre: z.string().min(1, "Genre is required"),
  posterUrl: z.string().url("Invalid URL").optional(),
});

export const updateMovieSchema = createMovieSchema.partial();

export type CreateMovieInput = z.infer<typeof createMovieSchema>;
export type UpdateMovieInput = z.infer<typeof updateMovieSchema>;
