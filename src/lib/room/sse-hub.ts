import type { WSServerMessage } from "@/lib/types";

const g = global as typeof globalThis & {
  __guesswhat_sse_rooms?: Map<string, Set<ReadableStreamDefaultController>>;
};

if (!g.__guesswhat_sse_rooms) {
  g.__guesswhat_sse_rooms = new Map();
}

const roomSubscribers = g.__guesswhat_sse_rooms;

export function addRoomSubscriber(roomId: string, controller: ReadableStreamDefaultController) {
  if (!roomSubscribers.has(roomId)) {
    roomSubscribers.set(roomId, new Set());
  }
  roomSubscribers.get(roomId)!.add(controller);

  return () => {
    const set = roomSubscribers.get(roomId);
    if (!set) return;
    set.delete(controller);
    if (set.size === 0) {
      roomSubscribers.delete(roomId);
    }
  };
}

export function broadcastToRoom(roomId: string, msg: WSServerMessage) {
  const subs = roomSubscribers.get(roomId);
  if (!subs) return;
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const controller of subs) {
    try {
      controller.enqueue(data);
    } catch {
      // Ignore broken streams
    }
  }
}
