import type { Room, RoomSettings, Player } from "@/lib/types";
import { generateRoomCode, serializeRoom } from "@/lib/utils";
import { createPlayer } from "@/lib/game/engine";

/**
 * In-memory room store.
 * Rooms exist only in server memory. No persistence.
 */
const g = global as typeof globalThis & { __guesswhat_rooms?: Map<string, Room> };
if (!g.__guesswhat_rooms) g.__guesswhat_rooms = new Map<string, Room>();
const rooms = g.__guesswhat_rooms;

const ROOM_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

export function createRoom(settings: RoomSettings, hostName: string): { room: Room; hostPlayer: Player } {
  const id = generateRoomCode();
  const hostPlayer = createPlayer(hostName);

  const room: Room = {
    id,
    name: settings.name,
    hostId: hostPlayer.id,
    topic: settings.topic,
    difficulty: settings.difficulty,
    totalRounds: settings.totalRounds,
    timerSeconds: settings.timerSeconds,
    maxPlayers: settings.maxPlayers,
    players: new Map([[hostPlayer.id, hostPlayer]]),
    sessionId: null,
    status: "lobby",
    createdAt: Date.now(),
  };

  rooms.set(id, room);
  return { room, hostPlayer };
}

export function getRoom(id: string): Room | undefined {
  const room = rooms.get(id);
  if (room && Date.now() - room.createdAt > ROOM_TTL_MS) {
    rooms.delete(id);
    return undefined;
  }
  return room;
}

export function joinRoom(roomId: string, playerName: string): { player: Player; room: Room } | null {
  const room = getRoom(roomId);
  if (!room) return null;
  if (room.status !== "lobby") return null;
  if (room.players.size >= room.maxPlayers) return null;

  const player = createPlayer(playerName);
  room.players.set(player.id, player);
  rooms.set(roomId, room);

  return { player, room };
}

export function removePlayer(roomId: string, playerId: string): Room | null {
  const room = getRoom(roomId);
  if (!room) return null;

  room.players.delete(playerId);

  // If no players left, delete room
  if (room.players.size === 0) {
    rooms.delete(roomId);
    return null;
  }

  // If host left, assign new host
  if (room.hostId === playerId) {
    const nextPlayer = room.players.values().next().value;
    if (nextPlayer) {
      room.hostId = nextPlayer.id;
    }
  }

  rooms.set(roomId, room);
  return room;
}

export function setRoomStatus(roomId: string, status: Room["status"]): void {
  const room = getRoom(roomId);
  if (room) {
    room.status = status;
    rooms.set(roomId, room);
  }
}

export function setRoomSession(roomId: string, sessionId: string): void {
  const room = getRoom(roomId);
  if (room) {
    room.sessionId = sessionId;
    rooms.set(roomId, room);
  }
}

export function deleteRoom(id: string): void {
  rooms.delete(id);
}

export function listRooms(): Room[] {
  const now = Date.now();
  const result: Room[] = [];
  for (const [id, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(id);
    } else {
      result.push(room);
    }
  }
  return result;
}

export function getSerializedRoom(id: string) {
  const room = getRoom(id);
  if (!room) return null;
  return serializeRoom(room);
}

// Periodic cleanup
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
      if (now - room.createdAt > ROOM_TTL_MS) {
        rooms.delete(id);
      }
    }
  }, 10 * 60 * 1000);
}
