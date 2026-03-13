import Redis from "ioredis";

// Redis is enabled when a connection URL is provided.
// Vercel injects KV_REDIS_URL when you link a Redis store to the project.
const isKvEnabled = !!process.env.KV_REDIS_URL;

// Reuse a single Redis connection across warm serverless invocations.
// ioredis handles reconnection and buffering automatically.
const g = global as typeof globalThis & {
  __guesswhat_redis?: Redis;
  __guesswhat_kv_mem?: Map<string, any>;
};

function getRedis(): Redis {
  if (!g.__guesswhat_redis) {
    g.__guesswhat_redis = new Redis(process.env.KV_REDIS_URL!, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      // Don't throw on connect errors — we log and degrade gracefully
      lazyConnect: false,
    });
    g.__guesswhat_redis.on("error", (err) => {
      console.error("[kv-store] Redis connection error:", err.message);
    });
  }
  return g.__guesswhat_redis;
}

// In-memory store is ONLY used when Redis is NOT available (local dev).
// When Redis IS available, it is the single source of truth for every read/write.
if (!g.__guesswhat_kv_mem) g.__guesswhat_kv_mem = new Map<string, any>();
const memoryStore = g.__guesswhat_kv_mem;

export async function kvGet<T>(key: string): Promise<T | null> {
  if (isKvEnabled) {
    try {
      const raw = await getRedis().get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[kv-store] kvGet("${key}") failed:`, err);
      return null;
    }
  }

  const memValue = memoryStore.get(key);
  return memValue !== undefined ? (memValue as T) : null;
}

export async function kvSet(key: string, value: any, ttlSec: number = 3 * 60 * 60): Promise<void> {
  if (isKvEnabled) {
    try {
      const serialized = JSON.stringify(value);
      await getRedis().set(key, serialized, "EX", ttlSec);
    } catch (err) {
      console.error(`[kv-store] kvSet("${key}") failed:`, err);
    }
    return;
  }

  memoryStore.set(key, value);
}

export async function kvDelete(key: string): Promise<void> {
  if (isKvEnabled) {
    try {
      await getRedis().del(key);
    } catch (err) {
      console.error(`[kv-store] kvDelete("${key}") failed:`, err);
    }
    return;
  }

  memoryStore.delete(key);
}

/**
 * Scan for keys matching a glob pattern (e.g. "room:*").
 */
export async function kvKeys(pattern: string): Promise<string[]> {
  if (isKvEnabled) {
    try {
      const keys: string[] = [];
      let cursor = "0";
      do {
        const [nextCursor, batch] = await getRedis().scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        );
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== "0");
      return keys;
    } catch (err) {
      console.error(`[kv-store] kvKeys("${pattern}") failed:`, err);
      return [];
    }
  }

  // Local dev fallback
  const prefix = pattern.replace("*", "");
  const keys: string[] = [];
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  return keys;
}

// ─── List operations (atomic append via RPUSH) ───

/**
 * Atomically append a value to a Redis list. No read-modify-write race.
 */
export async function kvListAppend(key: string, value: any, ttlSec: number): Promise<void> {
  if (isKvEnabled) {
    try {
      const redis = getRedis();
      await redis.rpush(key, JSON.stringify(value));
      await redis.expire(key, ttlSec);
    } catch (err) {
      console.error(`[kv-store] kvListAppend("${key}") failed:`, err);
    }
    return;
  }

  if (!memoryStore.has(key)) memoryStore.set(key, []);
  memoryStore.get(key).push(value);
}

/**
 * Read list items from `start` index to the end.
 */
export async function kvListRange(key: string, start: number): Promise<any[]> {
  if (isKvEnabled) {
    try {
      const items = await getRedis().lrange(key, start, -1);
      return items.map((item) => JSON.parse(item));
    } catch (err) {
      console.error(`[kv-store] kvListRange("${key}", ${start}) failed:`, err);
      return [];
    }
  }

  const arr = memoryStore.get(key) || [];
  return arr.slice(start);
}
