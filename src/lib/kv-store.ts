import { kv } from "@vercel/kv";

// Safely checks if KV is configured (Vercel injects this automatically when KV is linked)
export const isKvEnabled = !!process.env.KV_REST_API_URL;

const memoryStore = new Map<string, any>();

export async function kvGet<T>(key: string): Promise<T | null> {
  if (isKvEnabled) {
    try {
      return await kv.get<T>(key);
    } catch {
      return null;
    }
  }
  return memoryStore.get(key) || null;
}

export async function kvSet(key: string, value: any, ttlSec: number = 3 * 60 * 60): Promise<void> {
  if (isKvEnabled) {
    try {
      await kv.set(key, value, { ex: ttlSec });
    } catch {
      // Ignore
    }
  } else {
    memoryStore.set(key, value);
    // Cleanup memory simply by ignoring TTL since it dies on cold start anyway
  }
}

export async function kvDelete(key: string): Promise<void> {
  if (isKvEnabled) {
    try {
      await kv.del(key);
    } catch {
      // Ignore
    }
  } else {
    memoryStore.delete(key);
  }
}
