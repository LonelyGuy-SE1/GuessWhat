import { NextRequest, NextResponse } from "next/server";
import { createRoom, listRooms } from "@/lib/room/manager";
import { setRoomApiKey } from "@/lib/room/api-key-store";
import { serializeRoom } from "@/lib/utils";
import type { RoomSettings } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { settings, hostName, apiKey } = body as {
    settings: RoomSettings;
    hostName: string;
    apiKey: string;
  };

  if (!settings?.topic || !hostName || !apiKey) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validSettings: RoomSettings = {
    name: settings.name || `${hostName}'s Room`,
    topic: settings.topic,
    difficulty: (["easy", "medium", "hard"].includes(settings.difficulty) ? settings.difficulty : "medium") as RoomSettings["difficulty"],
    totalRounds: Math.min(Math.max(settings.totalRounds || 10, 1), 50),
    timerSeconds: Math.min(Math.max(settings.timerSeconds || 30, 10), 120),
    maxPlayers: Math.min(Math.max(settings.maxPlayers || 20, 2), 100),
  };

  const { room, hostPlayer } = await createRoom(validSettings, hostName);

  await setRoomApiKey(room.id, apiKey);

  return NextResponse.json({
    room: serializeRoom(room),
    playerId: hostPlayer.id,
  });
}

export async function GET() {
  const rooms = (await listRooms())
    .filter((r) => r.status === "lobby")
    .map((r) => serializeRoom(r));

  return NextResponse.json({ rooms });
}
