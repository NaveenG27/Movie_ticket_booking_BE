import prisma from "../../config/db";
import { AppError } from "../../utils/AppError";
import { CreateTheaterInput, UpdateTheaterInput } from "./theater.validation";

/**
 * Verify ownership: admin can access any theater, theater owner can only
 * access their own. Throws 403 if not authorized.
 */
async function verifyOwnership(theaterId: string, userId: string, role: string) {
  const theater = await prisma.theater.findUnique({ where: { id: theaterId } });
  if (!theater) throw AppError.notFound("Theater not found");

  if (role !== "ADMIN" && theater.ownerId !== userId) {
    throw AppError.forbidden("You can only manage your own theaters");
  }

  return theater;
}

export async function createTheater(
  data: CreateTheaterInput,
  ownerId: string
) {
  // Verify the owner exists
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) throw AppError.notFound("Owner not found");

  return prisma.theater.create({
    data: { ...data, ownerId },
  });
}

export async function getTheaters(filters?: { city?: string }) {
  const where: any = {};
  if (filters?.city) where.city = filters.city;

  return prisma.theater.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { screens: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTheaterById(id: string) {
  const theater = await prisma.theater.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      screens: true,
    },
  });
  if (!theater) throw AppError.notFound("Theater not found");
  return theater;
}

export async function updateTheater(
  id: string,
  data: UpdateTheaterInput,
  userId: string,
  role: string
) {
  await verifyOwnership(id, userId, role);
  return prisma.theater.update({ where: { id }, data });
}

export async function deleteTheater(
  id: string,
  userId: string,
  role: string
) {
  await verifyOwnership(id, userId, role);
  return prisma.theater.delete({ where: { id } });
}
