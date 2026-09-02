import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { initSocketIO } from "./config/socket";
import { registerSeatLockingHandlers } from "./sockets/seatLocking";
import { startLockCleanupPolling, stopLockCleanupPolling } from "./config/lockCleanup";
import { startKeyspaceNotificationListener } from "./config/redis";
import { handleExpiredLock } from "./modules/booking/booking.service";

const PORT = process.env.PORT || 3000;

// ─── Create HTTP server ─────────────────────────────────────
const httpServer = http.createServer(app);

// ─── Initialize Socket.io ───────────────────────────────────
const io = initSocketIO(httpServer);
registerSeatLockingHandlers(io);

// ─── Seat lock expiry handling (dual strategy) ─────────────
//
// Strategy 1 — Redis keyspace notifications (event-driven, fast):
//   When Redis can publish Ex events, this fires immediately on
//   key expiry. This is the ideal path — zero delay between TTL
//   hit and Postgres revert.
//
// Strategy 2 — Polling fallback (periodic, reliable):
//   Upstash Redis (free tier) does not support CONFIG SET, so
//   keyspace notifications can't be enabled. This polling loop
//   queries LOCKED seats every 30s and checks whether their
//   Redis key still exists. If the key is gone, the seat is
//   reverted to AVAILABLE. Runs once on startup to catch any
//   stale locks from a prior crash.
//
// Both strategies are idempotent: if the keyspace listener already
// reverted a seat, the poller will skip it (status won't be LOCKED).

// Try keyspace notifications — this may silently fail on Upstash
try {
  startKeyspaceNotificationListener(handleExpiredLock);
} catch (err) {
  console.warn("⚠️  Could not start Redis keyspace listener:", err);
  console.warn("    Polling-based cleanup will handle lock expiry.");
}

// Always start the polling fallback (safe even if keyspace works)
startLockCleanupPolling(io);

// ─── Graceful shutdown ─────────────────────────────────────
function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  stopLockCleanupPolling();
  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });

  // Force exit after 5s if connections don't drain
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Start Server ───────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║   🎬 Movie Ticket Booking API                           ║
  ║   📡 Server running on http://localhost:${PORT}           ║
  ║   🔌 Socket.io enabled                                  ║
  ║   🗄️  PostgreSQL + Prisma                               ║
  ║   🔴 Redis connected                                    ║
  ║   🧹 Lock cleanup: polling every 30s + keyspace events  ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

export { httpServer, io };
