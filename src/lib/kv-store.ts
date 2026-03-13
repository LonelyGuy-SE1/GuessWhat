import { kv } from "@vercel/kv";

// Safely checks if KV is configured (Vercel injects this automatically when KV is linked)
export const isKvEnabled = !!process.env.KV_REST_API_URL;

// In-memory store acts as a fast local cache within a single serverless invocation.
// On Vercel with KV enabled, this ensures reads within the same request are consistent
// after writes, without waiting for KV round-trips.
const g = global as typeof globalThis & { __guesswhat_kv_mem?: Map<string, any> };
if (!g.__guesswhat_kv_mem) g.__guesswhat_kv_mem = new Map<string, any>();
const memoryStore = g.__guesswhat_kv_mem;

export async function kvGet<T>(key: string): Promise<T | null> {
  // Always check memory first (fastest, always consistent within same invocation)
  const memValue = memoryStore.get(key);
  if (memValue !== undefined) return memValue as T;

  // Fall back to KV for cross-invocation persistence
  if (isKvEnabled) {
    try {
      const kvValue = await kv.get<T>(key);
      if (kvValue !== null && kvValue !== undefined) {
        // Cache in memory for subsequent reads in this invocation
        memoryStore.set(key, kvValue);
        return kvValue;
      }
    } catch {
      // KV read failed, return null
    }
  }

  return null;
}

export async function kvSet(key: string, value: any, ttlSec: number = 3 * 60 * 60): Promise<void> {
  // Always write to memory for immediate consistency
  memoryStore.set(key, value);

  // Also persist to KV for cross-invocation durability
  if (isKvEnabled) {
    try {
      await kv.set(key, value, { ex: ttlSec });
    } catch {
      // KV write failed silently - memory still has the data for this invocation
    }
  }
}

export async function kvDelete(key: string): Promise<void> {
  // Always delete from both
  memoryStore.delete(key);

  if (isKvEnabled) {
    try {
      await kv.del(key);
    } catch {
      // Ignore
    }
  }
}

/**
 * Scan for keys matching a pattern. Only works with KV enabled.
 * Falls back to iterating memory store keys.
 */
export async function kvKeys(pattern: string): Promise<string[]> {
  if (isKvEnabled) {
    try {
      const keys: string[] = [];
      let cursor = 0;
      // Use SCAN to iterate through keys matching the pattern
      do {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: [number, string[]] = await kv.scan(cursor, { match: pattern, count: 100 }) as any;
        cursor = result[0];
        keys.push(...result[1].map(String));
      } while (cursor !== 0);
      return keys;
    } catch {
      // Fall through to memory scan
    }
  }

  // Memory fallback: filter keys by simple glob pattern (e.g. "room:*")
  const prefix = pattern.replace("*", "");
  const keys: string[] = [];
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  return keys;
}
