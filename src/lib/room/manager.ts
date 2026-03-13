import type { Room, RoomSettings, Player, SerializedRoom } from "@/lib/types";
import { generateRoomCode, serializeRoom } from "@/lib/utils";
import { createPlayer } from "@/lib/game/engine";
import { kvGet, kvSet, kvDelete, kvKeys } from "@/lib/kv-store";

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
  return { room, hostPlayer };
}

export async function saveRoom(room: Room): Promise<void> {
  const serialized = serializeRoom(room);
  await kvSet(`room:${room.id}`, serialized, ROOM_TTL_SEC);
}

export async function getRoom(id: string): Promise<Room | undefined> {
  const data = await kvGet<SerializedRoom>(`room:${id}`);
  
  if (!data) return undefined;
  
  // Check TTL (memory store doesn't honor TTL, and this acts as a safety net)
  if (Date.now() - data.createdAt > ROOM_TTL_SEC * 1000) {
    await deleteRoom(id);
    return undefined;
  }

  // Restore the Map from the serialized array
  const room: Room = {
    ...data,
    players: new Map(data.players.map(p => [p.id, p])),
  };
  
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
}

export async function getSerializedRoom(id: string): Promise<SerializedRoom | null> {
  const room = await getRoom(id);
  if (!room) return null;
  return serializeRoom(room);
}

export async function listRooms(): Promise<Room[]> {
  const now = Date.now();
  const result: Room[] = [];

  try {
    const keys = await kvKeys("room:*");
    for (const key of keys) {
      const data = await kvGet<SerializedRoom>(key);
      if (!data) continue;

      if (now - data.createdAt > ROOM_TTL_SEC * 1000) {
        await kvDelete(key);
        continue;
      }

      const room: Room = {
        ...data,
        players: new Map(data.players.map(p => [p.id, p])),
      };
      result.push(room);
    }
  } catch {
    // If scanning fails, return empty
  }

  return result;
}
