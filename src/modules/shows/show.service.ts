import prisma from "../../config/db";
import { AppError } from "../../utils/AppError";
import { CreateShowInput, UpdateShowInput } from "./show.validation";

export async function createShow(
  data: CreateShowInput,
  userId: string,
  role: string
) {
  // Verify movie exists
  const movie = await prisma.movie.findUnique({ where: { id: data.movieId } });
  if (!movie) throw AppError.notFound("Movie not found");

  // Verify screen exists and user has access
  const screen = await prisma.screen.findUnique({
    where: { id: data.screenId },
    include: { theater: true },
  });
  if (!screen) throw AppError.notFound("Screen not found");

  if (role !== "ADMIN" && screen.theater.ownerId !== userId) {
    throw AppError.forbidden("You can only create shows in your own theaters");
  }

  // Validate time range
  const startTime = new Date(data.startTime);
  const endTime = new Date(data.endTime);
  if (endTime <= startTime) {
    throw AppError.badRequest("End time must be after start time");
  }

  // Check for overlapping shows on the same screen
  const overlapping = await prisma.show.findFirst({
    where: {
      screenId: data.screenId,
      OR: [
        {
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      ],
    },
  });

  if (overlapping) {
    throw AppError.conflict(
      "This screen already has a show scheduled during this time"
    );
  }

  // Create show + ShowSeat entries for every seat on the screen
  const seats = await prisma.seat.findMany({
    where: { screenId: data.screenId },
  });

  return prisma.$transaction(async (tx) => {
    const show = await tx.show.create({
      data: {
        movieId: data.movieId,
        screenId: data.screenId,
        startTime,
        endTime,
        basePrice: data.basePrice,
      },
    });

    // Create a ShowSeat row for every seat on this screen
    // Price = basePrice (can be adjusted by seat type: premium +20%, recliner +50%)
    const showSeats = seats.map((seat) => {
      let priceMultiplier = 1;
      if (seat.seatType === "PREMIUM") priceMultiplier = 1.2;
      if (seat.seatType === "RECLINER") priceMultiplier = 1.5;

      const price = Number(data.basePrice) * priceMultiplier;

      return {
        showId: show.id,
        seatId: seat.id,
        price,
      };
    });

    await tx.showSeat.createMany({ data: showSeats });

    return show;
  });
}

export async function getShows(filters?: {
  movieId?: string;
  city?: string;
  date?: string;
  theaterId?: string;
}) {
  const where: any = {};

  if (filters?.movieId) where.movieId = filters.movieId;

  if (filters?.theaterId) where.screenId = { theaterId: filters.theaterId };

  // Filter by city through the theater relation
  if (filters?.city) {
    where.screen = {
      theater: { city: { contains: filters.city, mode: "insensitive" } },
    };
  }

  // Filter by date
  if (filters?.date) {
    const dayStart = new Date(filters.date);
    const dayEnd = new Date(filters.date);
    dayEnd.setDate(dayEnd.getDate() + 1);

    where.startTime = { gte: dayStart, lt: dayEnd };
  }

  return prisma.show.findMany({
    where,
    include: {
      movie: { select: { id: true, title: true, durationMin: true, language: true, posterUrl: true } },
      screen: {
        select: {
          id: true,
          name: true,
          theater: { select: { id: true, name: true, city: true } },
        },
      },
      _count: { select: { showSeats: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getShowById(id: string) {
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      movie: true,
      screen: {
        include: {
          theater: { select: { id: true, name: true, city: true } },
        },
      },
    },
  });
  if (!show) throw AppError.notFound("Show not found");
  return show;
}

/**
 * Get the seat map for a show with real-time statuses.
 * This is the endpoint clients poll after subscribing via Socket.io
 * to get the initial state of all seats.
 */
export async function getShowSeats(showId: string) {
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) throw AppError.notFound("Show not found");

  const showSeats = await prisma.showSeat.findMany({
    where: { showId },
    include: {
      seat: { select: { id: true, row: true, number: true, seatType: true } },
    },
    orderBy: [{ seat: { row: "asc" } }, { seat: { number: "asc" } }],
  });

  return showSeats;
}

export async function updateShow(
  id: string,
  data: UpdateShowInput,
  userId: string,
  role: string
) {
  const show = await prisma.show.findUnique({
    where: { id },
    include: { screen: { include: { theater: true } } },
  });
  if (!show) throw AppError.notFound("Show not found");

  if (role !== "ADMIN" && show.screen.theater.ownerId !== userId) {
    throw AppError.forbidden("You can only manage shows in your own theaters");
  }

  return prisma.show.update({ where: { id }, data });
}

export async function deleteShow(
  id: string,
  userId: string,
  role: string
) {
  const show = await prisma.show.findUnique({
    where: { id },
    include: { screen: { include: { theater: true } } },
  });
  if (!show) throw AppError.notFound("Show not found");

  if (role !== "ADMIN" && show.screen.theater.ownerId !== userId) {
    throw AppError.forbidden("You can only manage shows in your own theaters");
  }

  return prisma.show.delete({ where: { id } });
}
