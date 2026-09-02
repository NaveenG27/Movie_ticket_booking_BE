import { Server } from "socket.io";
import prisma from "./db";
import { getValue } from "./redis";

/**
 * Polling-based seat lock cleanup
 * ──────────────────────────────────
 * Upstash Redis (managed/free tier) does not support CONFIG SET,
 * so keyspace notifications (Ex events) can't be enabled. This
 * polling loop acts as a reliable fallback.
 *
 * Every POLL_INTERVAL_MS milliseconds, it:
 *   1. Queries all ShowSeat rows with status = LOCKED
 *   2. For each, checks if the Redis key `lock:show:{showId}:seat:{seatId}`
 *      still exists (i.e., the lock hasn't expired yet)
 *   3. If the Redis key is GONE but ShowSeat is still LOCKED → the lock
 *      expired without a booking. Revert status to AVAILABLE in Postgres.
 *   4. Broadcasts `seat_released` to the Socket.io room so all clients
 *      see the seat become available in real-time.
 *
 * The keyspace notification listener (in server.ts) is still attempted
 * on startup — it's the faster, event-driven path when available. This
 * polling loop closes the gap when it isn't.
 */

const POLL_INTERVAL_MS = 30_000; // 30 seconds

const seatLockKey = (showId: string, seatId: string) =>
  `lock:show:${showId}:seat:${seatId}`;

let cleanupTimer: NodeJS.Timeout | null = null;

async function cleanupExpiredLocks(io: Server | null): Promise<void> {
  try {
    // Fetch all ShowSeat rows currently in LOCKED status.
    // We fetch all because the number of simultaneously locked seats
    // at any point should be small (users are actively selecting).
    // If this grows large, we can add a WHERE clause to only check
    // seats locked within the last 10 minutes.
    const lockedSeats = await prisma.showSeat.findMany({
      where: { status: "LOCKED" },
      select: {
        id: true,
        showId: true,
        seatId: true,
        lockedBy: true,
      },
    });

    if (lockedSeats.length === 0) return;

    const expiredSeats: { showId: string; seatId: string }[] = [];

    // Check each locked seat against Redis
    for (const ss of lockedSeats) {
      const lockExists = await getValue(seatLockKey(ss.showId, ss.seatId));

      if (!lockExists) {
        // Redis key is gone (TTL expired) but ShowSeat is still LOCKED.
        // This means the user never confirmed the booking in time.
        // Revert the seat to AVAILABLE.
        expiredSeats.push({ showId: ss.showId, seatId: ss.seatId });
      }
    }

    if (expiredSeats.length === 0) return;

    // Batch update all expired seats in Postgres
    const expiredIds = await Promise.all(
      expiredSeats.map(async ({ showId, seatId }) => {
        await prisma.showSeat.updateMany({
          where: {
            showId,
            seatId,
            status: "LOCKED", // double-check: only revert if still LOCKED
          },
          data: { status: "AVAILABLE", lockedBy: null },
        });
        return { showId, seatId };
      })
    );

    console.log(
      `🧹 Lock cleanup: reverted ${expiredIds.length} expired seat(s)`
    );

    // Broadcast seat_released to each affected show room
    if (io) {
      // Group by showId to emit once per room
      const byShow = new Map<string, string[]>();
      for (const { showId, seatId } of expiredIds) {
        const existing = byShow.get(showId) || [];
        existing.push(seatId);
        byShow.set(showId, existing);
      }

      for (const [showId, seatIds] of byShow) {
        io.to(`show:${showId}`).emit("seat_released", {
          showId,
          seatIds, // emit all at once so clients can batch-update
          reason: "lock_expired",
        });
      }
    }
  } catch (err) {
    console.error("🧹 Lock cleanup error:", err);
    // Don't throw — polling must never crash the server
  }
}

/**
 * Start the polling-based lock cleanup.
 * Called from server.ts on startup.
 */
export function startLockCleanupPolling(io: Server): void {
  // Run once immediately on startup to catch any stale locks
  // from a previous server crash/restart (before the interval kicks in)
  cleanupExpiredLocks(io);

  cleanupTimer = setInterval(() => {
    cleanupExpiredLocks(io);
  }, POLL_INTERVAL_MS);

  console.log(
    `✅ Lock cleanup polling started (every ${POLL_INTERVAL_MS / 1000}s)`
  );
}

/**
 * Stop the polling loop (for graceful shutdown).
 */
export function stopLockCleanupPolling(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log("🛑 Lock cleanup polling stopped");
  }
}
