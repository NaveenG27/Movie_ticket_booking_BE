import prisma from "../../config/db";
import { AppError } from "../../utils/AppError";
import { CreateMovieInput, UpdateMovieInput } from "./movie.validation";

export async function createMovie(data: CreateMovieInput) {
  return prisma.movie.create({ data });
}

export async function getMovies(filters?: {
  language?: string;
  genre?: string;
  search?: string;
}) {
  const where: any = {};

  if (filters?.language) where.language = filters.language;
  if (filters?.genre) where.genre = filters.genre;
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.movie.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function getMovieById(id: string) {
  const movie = await prisma.movie.findUnique({ where: { id } });
  if (!movie) throw AppError.notFound("Movie not found");
  return movie;
}

export async function updateMovie(id: string, data: UpdateMovieInput) {
  // Check existence
  await getMovieById(id);

  return prisma.movie.update({ where: { id }, data });
}

export async function deleteMovie(id: string) {
  // Check existence
  await getMovieById(id);

  return prisma.movie.delete({ where: { id } });
}
