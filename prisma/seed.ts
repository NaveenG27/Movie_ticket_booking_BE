import { PrismaClient, Role, SeatType } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Users ──────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", SALT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@example.com",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const theaterOwner = await prisma.user.create({
    data: {
      name: "Theater Owner",
      email: "owner@example.com",
      passwordHash,
      role: Role.THEATER_OWNER,
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "John Customer",
      email: "customer@example.com",
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  console.log("✅ Users created");

  // ─── Movies ─────────────────────────────────────────────
  const movies = await Promise.all([
    prisma.movie.create({
      data: {
        title: "Inception",
        description: "A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea into the mind of a CEO.",
        durationMin: 148,
        language: "English",
        genre: "Sci-Fi",
        posterUrl: "https://image.tmdb.org/t/p/w500/inception.jpg",
      },
    }),
    prisma.movie.create({
      data: {
        title: "The Dark Knight",
        description: "Batman raises the stakes in his war on crime, confronting the Joker, a criminal mastermind who wants to plunge Gotham into anarchy.",
        durationMin: 152,
        language: "English",
        genre: "Action",
        posterUrl: "https://image.tmdb.org/t/p/w500/dark-knight.jpg",
      },
    }),
    prisma.movie.create({
      data: {
        title: "Interstellar",
        description: "A team of explorers travel through a wormhole in space to ensure humanity's survival.",
        durationMin: 169,
        language: "English",
        genre: "Sci-Fi",
        posterUrl: "https://image.tmdb.org/t/p/w500/interstellar.jpg",
      },
    }),
    prisma.movie.create({
      data: {
        title: "The Shawshank Redemption",
        description: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
        durationMin: 142,
        language: "English",
        genre: "Drama",
        posterUrl: "https://image.tmdb.org/t/p/w500/shawshank.jpg",
      },
    }),
  ]);

  console.log("✅ Movies created");

  // ─── Theaters ───────────────────────────────────────────
  const theater1 = await prisma.theater.create({
    data: {
      name: "Grand Cinema Downtown",
      city: "New York",
      ownerId: theaterOwner.id,
    },
  });

  const theater2 = await prisma.theater.create({
    data: {
      name: "Cineplex Midtown",
      city: "New York",
      ownerId: theaterOwner.id,
    },
  });

  console.log("✅ Theaters created");

  // ─── Screens ────────────────────────────────────────────
  // Screen 1: 50 seats
  const screen1 = await prisma.screen.create({
    data: {
      theaterId: theater1.id,
      name: "Screen 1 — IMAX",
      totalSeats: 50,
    },
  });

  // Screen 2: 30 seats
  const screen2 = await prisma.screen.create({
    data: {
      theaterId: theater1.id,
      name: "Screen 2 — Dolby Atmos",
      totalSeats: 30,
    },
  });

  console.log("✅ Screens created");

  // ─── Seats ──────────────────────────────────────────────
  // Generate seats for Screen 1
  const screen1Seats: { screenId: string; row: string; number: number; seatType: SeatType }[] = [];
  const rows = ["A", "B", "C", "D", "E"];
  const seatsPerRow = 10;

  for (const row of rows) {
    let seatType: SeatType;
    if (row === "A" || row === "B") seatType = SeatType.REGULAR;
    else if (row === "C" || row === "D") seatType = SeatType.PREMIUM;
    else seatType = SeatType.RECLINER;

    for (let s = 1; s <= seatsPerRow; s++) {
      screen1Seats.push({ screenId: screen1.id, row, number: s, seatType });
    }
  }

  await prisma.seat.createMany({ data: screen1Seats });

  // Generate seats for Screen 2
  const screen2Seats: { screenId: string; row: string; number: number; seatType: SeatType }[] = [];
  const rows2 = ["A", "B", "C"];
  const seatsPerRow2 = 10;

  for (const row of rows2) {
    for (let s = 1; s <= seatsPerRow2; s++) {
      screen2Seats.push({
        screenId: screen2.id,
        row,
        number: s,
        seatType: SeatType.REGULAR,
      });
    }
  }

  await prisma.seat.createMany({ data: screen2Seats });

  console.log("✅ Seats created");

  // ─── Shows ──────────────────────────────────────────────
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(10, 0, 0, 0);

  const show1 = await prisma.show.create({
    data: {
      movieId: movies[0].id, // Inception
      screenId: screen1.id,
      startTime: todayStart,
      endTime: new Date(todayStart.getTime() + movies[0].durationMin * 60000),
      basePrice: 15.0,
    },
  });

  const show2 = await prisma.show.create({
    data: {
      movieId: movies[1].id, // The Dark Knight
      screenId: screen1.id,
      startTime: new Date(todayStart.getTime() + movies[0].durationMin * 60000 + 30 * 60000),
      endTime: new Date(
        todayStart.getTime() + movies[0].durationMin * 60000 + 30 * 60000 + movies[1].durationMin * 60000
      ),
      basePrice: 18.0,
    },
  });

  const show3 = await prisma.show.create({
    data: {
      movieId: movies[2].id, // Interstellar
      screenId: screen2.id,
      startTime: new Date(todayStart.getTime() + 2 * 60 * 60000),
      endTime: new Date(todayStart.getTime() + 2 * 60 * 60000 + movies[2].durationMin * 60000),
      basePrice: 20.0,
    },
  });

  console.log("✅ Shows created");

  // ─── ShowSeats ──────────────────────────────────────────
  // Generate ShowSeat entries for each show
  const allScreen1Seats = await prisma.seat.findMany({
    where: { screenId: screen1.id },
  });

  const allScreen2Seats = await prisma.seat.findMany({
    where: { screenId: screen2.id },
  });

  // Show 1 (screen 1)
  await prisma.showSeat.createMany({
    data: allScreen1Seats.map((seat) => ({
      showId: show1.id,
      seatId: seat.id,
      price: seat.seatType === "RECLINER" ? 25.0 : seat.seatType === "PREMIUM" ? 18.0 : 15.0,
    })),
  });

  // Show 2 (screen 1)
  await prisma.showSeat.createMany({
    data: allScreen1Seats.map((seat) => ({
      showId: show2.id,
      seatId: seat.id,
      price: seat.seatType === "RECLINER" ? 27.0 : seat.seatType === "PREMIUM" ? 21.6 : 18.0,
    })),
  });

  // Show 3 (screen 2)
  await prisma.showSeat.createMany({
    data: allScreen2Seats.map((seat) => ({
      showId: show3.id,
      seatId: seat.id,
      price: 20.0,
    })),
  });

  console.log("✅ ShowSeats created");

  // ─── Summary ────────────────────────────────────────────
  console.log("\n🎉 Seed complete!\n");
  console.log("Test accounts (password: 'password123'):");
  console.log("─────────────────────────────────────────");
  console.log(`  Admin:          ${admin.email}`);
  console.log(`  Theater Owner:  ${theaterOwner.email}`);
  console.log(`  Customer:       ${customer.email}`);
  console.log("\nSample data:");
  console.log(`  ${movies.length} movies`);
  console.log(`  2 theaters (both owned by ${theaterOwner.name})`);
  console.log(`  2 screens (${allScreen1Seats.length} + ${allScreen2Seats.length} seats)`);
  console.log(`  3 shows`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
