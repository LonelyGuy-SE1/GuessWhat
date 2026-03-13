import { kvGet, kvSet, kvDelete } from "@/lib/kv-store";

const KEY_TTL_SEC = 3 * 60 * 60; // 3 hours

export async function setRoomApiKey(roomId: string, apiKey: string): Promise<void> {
  await kvSet(`apikey:${roomId}`, apiKey, KEY_TTL_SEC);
}

export async function getRoomApiKey(roomId: string): Promise<string | undefined> {
  const key = await kvGet<string>(`apikey:${roomId}`);
  return key || undefined;
}

export async function deleteRoomApiKey(roomId: string): Promise<void> {
  await kvDelete(`apikey:${roomId}`);
}
