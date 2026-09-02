import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

// Helper: set a key with TTL (seconds)
export async function setWithTTL(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key, value, "EX", ttlSeconds);
}

// Helper: delete a key
export async function deleteKey(key: string): Promise<void> {
  await redis.del(key);
}

// Helper: get a key
export async function getValue(key: string): Promise<string | null> {
  return redis.get(key);
}

// ─── Keyspace notification listener ───────────────────────
// When a Redis key expires (seat lock TTL hit), we need to revert
// the ShowSeat status back to AVAILABLE in Postgres. We use Redis
// keyspace notifications (Ex event) to listen for expired keys.
//
// IMPORTANT: This requires CONFIG SET support on the Redis server.
// Upstash Redis (free tier) does NOT support this — the polling
// fallback in lockCleanup.ts handles that case. This listener is
// the ideal fast path when available, but the app must work
// correctly without it.

export function startKeyspaceNotificationListener(
  onExpire: (key: string) => void
): void {
  const sub = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  // Try to enable keyspace notifications. This will fail on
  // Upstash and other managed Redis providers that block CONFIG.
  // That's fine — the polling fallback covers it.
  sub
    .config("SET", "notify-keyspace-events", "Ex")
    .then(() => {
      console.log("✅ Redis keyspace notifications enabled (Ex events)");
    })
    .catch((err) => {
      // Log and continue — the polling fallback will handle expiry
      console.warn(
        "⚠️  Could not enable keyspace notifications:",
        err.message
      );
      console.warn(
        "    Polling-based cleanup will handle lock expiry instead."
      );
      // Close the subscriber since it can't do anything useful
      sub.disconnect();
    });

  // Only subscribe if config succeeded — but we attempt it
  // regardless because subscribe itself may still work on some
  // providers even if config doesn't.
  sub.subscribe("__keyevent@0__:expired").catch(() => {
    // Subscribe failed — that's expected on Upstash. Silent no-op.
  });

  sub.on("message", (_channel, message) => {
    // Only handle seat lock keys
    if (message.startsWith("lock:show:")) {
      onExpire(message);
    }
  });
}

export default redis;
