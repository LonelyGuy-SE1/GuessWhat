import type { Room, RoomSettings, Player, SerializedRoom } from "@/lib/types";
import { generateRoomCode, serializeRoom } from "@/lib/utils";
import { createPlayer } from "@/lib/game/engine";
import { kvGet, kvSet, kvDelete, isKvEnabled } from "@/lib/kv-store";

// Needed for listRooms fallback if KV isn't available
const g = global as typeof globalThis & { __guesswhat_rooms?: Map<string, Room> };
if (!g.__guesswhat_rooms) g.__guesswhat_rooms = new Map<string, Room>();
const fallbackRooms = g.__guesswhat_rooms;

const ROOM_TTL_SEC = 3 * 60 * 60; // 3 hours

export async function createRoom(settings: RoomSettings, hostName: string, forceId?: string): Promise<{ room: Room; hostPlayer: Player }> {
  const id = forceId || generateRoomCode();
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

  await saveRoom(room);
  
  // Track in fallback map for local dev without KV
  if (!isKvEnabled) fallbackRooms.set(id, room);

  return { room, hostPlayer };
}

export async function saveRoom(room: Room): Promise<void> {
  const serialized = serializeRoom(room);
  await kvSet(`room:${room.id}`, serialized, ROOM_TTL_SEC);
  if (!isKvEnabled) fallbackRooms.set(room.id, room);
}

export async function getRoom(id: string): Promise<Room | undefined> {
  const data = await kvGet<SerializedRoom>(`room:${id}`);
  
  if (!data) {
    if (!isKvEnabled) return fallbackRooms.get(id);
    return undefined;
  }
  
  if (Date.now() - data.createdAt > ROOM_TTL_SEC * 1000) {
    await deleteRoom(id);
    return undefined;
  }

  // Restore the Map from the serialized array
  const room = data as unknown as Room;
  room.players = new Map(data.players.map(p => [p.id, p]));
  
  return room;
}

export async function joinRoom(roomId: string, playerName: string): Promise<{ player: Player; room: Room } | null> {
  const room = await getRoom(roomId);
  if (!room) return null;
  if (room.status !== "lobby") return null;
  if (room.players.size >= room.maxPlayers) return null;

  const player = createPlayer(playerName);
  room.players.set(player.id, player);
  await saveRoom(room);

  return { player, room };
}

export async function removePlayer(roomId: string, playerId: string): Promise<Room | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  room.players.delete(playerId);

  if (room.players.size === 0) {
    await deleteRoom(roomId);
    return null;
  }

  if (room.hostId === playerId) {
    const nextPlayer = room.players.values().next().value;
    if (nextPlayer) {
      room.hostId = nextPlayer.id;
    }
  }

  await saveRoom(room);
  return room;
}

export async function setRoomStatus(roomId: string, status: Room["status"]): Promise<void> {
  const room = await getRoom(roomId);
  if (room) {
    room.status = status;
    await saveRoom(room);
  }
}

export async function setRoomSession(roomId: string, sessionId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (room) {
    room.sessionId = sessionId;
    await saveRoom(room);
  }
}

export async function deleteRoom(id: string): Promise<void> {
  await kvDelete(`room:${id}`);
  if (!isKvEnabled) fallbackRooms.delete(id);
}

export async function getSerializedRoom(id: string): Promise<SerializedRoom | null> {
  const room = await getRoom(id);
  if (!room) return null;
  return serializeRoom(room);
}

export async function listRooms(): Promise<Room[]> {
  // If KV isn't enabled, fallback to in-memory store mapping
  if (!isKvEnabled) {
    const now = Date.now();
    const result: Room[] = [];
    for (const [id, room] of fallbackRooms) {
      if (now - room.createdAt > ROOM_TTL_SEC * 1000) {
        fallbackRooms.delete(id);
      } else {
        result.push(room);
      }
    }
    return result;
  }

  // With KV, we don't naturally scan for public rooms since we don't have a public lobby feature implemented,
  // but if needed, we can implement `kv.keys('room:*')`. 
  // However, GuessWhat assumes rooms are joined via private code.
  // We'll return empty array for now as the app doesn't rely on it for gameplay.
  return [];
}
