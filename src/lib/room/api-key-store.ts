import { kvGet, kvSet, kvDelete, isKvEnabled } from "@/lib/kv-store";

// Use memory fallback when KV is disabled
const g = global as typeof globalThis & { __guesswhat_room_keys?: Map<string, string> };
if (!g.__guesswhat_room_keys) {
  g.__guesswhat_room_keys = new Map<string, string>();
}
const fallbackKeys = g.__guesswhat_room_keys;

const KEY_TTL_SEC = 3 * 60 * 60; // 3 hours

export async function setRoomApiKey(roomId: string, apiKey: string): Promise<void> {
  await kvSet(`apikey:${roomId}`, apiKey, KEY_TTL_SEC);
  if (!isKvEnabled) fallbackKeys.set(roomId, apiKey);
}

export async function getRoomApiKey(roomId: string): Promise<string | undefined> {
  const key = await kvGet<string>(`apikey:${roomId}`);
  if (!key && !isKvEnabled) {
    return fallbackKeys.get(roomId);
  }
  return key || undefined;
}

export async function deleteRoomApiKey(roomId: string): Promise<void> {
  await kvDelete(`apikey:${roomId}`);
  if (!isKvEnabled) fallbackKeys.delete(roomId);
}
