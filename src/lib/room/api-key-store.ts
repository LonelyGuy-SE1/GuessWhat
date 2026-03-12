const g = global as typeof globalThis & { __guesswhat_room_keys?: Map<string, string> };
if (!g.__guesswhat_room_keys) {
  g.__guesswhat_room_keys = new Map<string, string>();
}
const roomApiKeys = g.__guesswhat_room_keys;

export function setRoomApiKey(roomId: string, apiKey: string) {
  roomApiKeys.set(roomId, apiKey);
}

export function getRoomApiKey(roomId: string): string | undefined {
  return roomApiKeys.get(roomId);
}

export function deleteRoomApiKey(roomId: string) {
  roomApiKeys.delete(roomId);
}
