import prisma from "../../config/db";
import { AppError } from "../../utils/AppError";
import { CreateScreenInput, UpdateScreenInput } from "./screen.validation";

/**
 * When creating a screen, automatically generate seats.
 * Layout assumption: rows are labeled A, B, C, ... and each row has
 * (totalSeats / numRows) seats. The last row may have fewer seats.
 *
 * Seat types are assigned by row:
 *   - First 60% of rows: REGULAR
 *   - Next 25%: PREMIUM
 *   - Last 15% (or at least the last row): RECLINER
 */
function generateSeatLayout(totalSeats: number) {
  const numRows = Math.ceil(Math.sqrt(totalSeats));
  const seatsPerRow = Math.ceil(totalSeats / numRows);
  const seats: { row: string; number: number; seatType: "REGULAR" | "PREMIUM" | "RECLINER" }[] = [];

  let seatCount = 0;

  for (let r = 0; r < numRows && seatCount < totalSeats; r++) {
    const rowLabel = String.fromCharCode(65 + r); // A, B, C, ...
    const countInRow = Math.min(seatsPerRow, totalSeats - seatCount);

    // Determine seat type based on row position
    const rowRatio = r / numRows;
    let seatType: "REGULAR" | "PREMIUM" | "RECLINER";
    if (rowRatio < 0.6) {
      seatType = "REGULAR";
    } else if (rowRatio < 0.85) {
      seatType = "PREMIUM";
    } else {
      seatType = "RECLINER";
    }

    for (let s = 1; s <= countInRow; s++) {
      seats.push({ row: rowLabel, number: s, seatType });
    }

    seatCount += countInRow;
  }

  return seats;
}

export async function createScreen(
  theaterId: string,
  data: CreateScreenInput,
  userId: string,
  role: string
) {
  // Verify theater exists and user owns it
  const theater = await prisma.theater.findUnique({ where: { id: theaterId } });
  if (!theater) throw AppError.notFound("Theater not found");

  if (role !== "ADMIN" && theater.ownerId !== userId) {
    throw AppError.forbidden("You can only manage screens in your own theaters");
  }

  // Create screen + seats in a transaction
  const seatLayout = generateSeatLayout(data.totalSeats);

  return prisma.$transaction(async (tx) => {
    const screen = await tx.screen.create({
      data: {
        name: data.name,
        totalSeats: data.totalSeats,
        theaterId,
      },
    });

    await tx.seat.createMany({
      data: seatLayout.map((s) => ({
        screenId: screen.id,
        row: s.row,
        number: s.number,
        seatType: s.seatType,
      })),
    });

    return screen;
  });
}

export async function getScreensByTheater(theaterId: string) {
  return prisma.screen.findMany({
    where: { theaterId },
    include: { seats: true },
  });
}

export async function getScreenById(id: string) {
  const screen = await prisma.screen.findUnique({
    where: { id },
    include: {
      seats: { orderBy: [{ row: "asc" }, { number: "asc" }] },
      theater: { select: { id: true, name: true, city: true } },
    },
  });
  if (!screen) throw AppError.notFound("Screen not found");
  return screen;
}

export async function updateScreen(
  id: string,
  data: UpdateScreenInput,
  userId: string,
  role: string
) {
  const screen = await prisma.screen.findUnique({
    where: { id },
    include: { theater: true },
  });
  if (!screen) throw AppError.notFound("Screen not found");

  if (role !== "ADMIN" && screen.theater.ownerId !== userId) {
    throw AppError.forbidden("You can only manage screens in your own theaters");
  }

  return prisma.screen.update({ where: { id }, data });
}

export async function deleteScreen(
  id: string,
  userId: string,
  role: string
) {
  const screen = await prisma.screen.findUnique({
    where: { id },
    include: { theater: true },
  });
  if (!screen) throw AppError.notFound("Screen not found");

  if (role !== "ADMIN" && screen.theater.ownerId !== userId) {
    throw AppError.forbidden("You can only manage screens in your own theaters");
  }

  return prisma.screen.delete({ where: { id } });
}
