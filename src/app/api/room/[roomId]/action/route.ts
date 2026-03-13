import { NextRequest, NextResponse } from "next/server";
import { getRoom, joinRoom, createRoom } from "@/lib/room/manager";
import { serializeRoom } from "@/lib/utils";
import { getRoomApiKey, setRoomApiKey } from "@/lib/room/api-key-store";
import { startGame, handleGuess, nextRound, pushEvent } from "@/lib/room/multiplayer-engine";
import type { RoomSettings } from "@/lib/types";

export const maxDuration = 60; // Allow 60 seconds for AI dataset generation on Vercel

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const { action, playerName, playerId, guess, roomSnapshot, apiKey } = body as {
    action: "join" | "start_game" | "guess" | "next_round" | "restore";
    playerName?: string;
    playerId?: string;
    guess?: string;
    roomSnapshot?: {
      settings: RoomSettings;
      hostName: string;
      apiKey: string;
    };
    apiKey?: string;
  };

  let room = await getRoom(roomId);

  if (!room && action === "restore" && roomSnapshot) {
    const restored = await createRoom(roomSnapshot.settings, roomSnapshot.hostName, roomId);
    if (roomSnapshot.apiKey) {
      await setRoomApiKey(restored.room.id, roomSnapshot.apiKey);
    }
    room = restored.room;
    return NextResponse.json({ playerId: restored.hostPlayer.id, room: serializeRoom(room) });
  }

  if (!room) {
    return NextResponse.json({ error: "Room not found. It may have expired." }, { status: 404 });
  }

  switch (action) {
    case "join": {
      if (playerId) {
        const existing = room.players.get(playerId);
        if (existing) {
          existing.connected = true;
          await pushEvent(roomId, { type: "room_state", room: serializeRoom(room) });
          return NextResponse.json({ playerId: existing.id, room: serializeRoom(room) });
        }
      }

      if (!playerName) {
        return NextResponse.json({ error: "Missing player name" }, { status: 400 });
      }

      const result = await joinRoom(roomId, playerName);
      if (!result) {
        return NextResponse.json({ error: "Cannot join room" }, { status: 400 });
      }

      await pushEvent(roomId, {
        type: "player_joined",
        player: {
          id: result.player.id,
          name: result.player.name,
          score: 0,
          connected: true,
        },
      });

      await pushEvent(roomId, { type: "room_state", room: serializeRoom(result.room) });

      return NextResponse.json({ playerId: result.player.id, room: serializeRoom(result.room) });
    }

    case "start_game": {
      if (!playerId || room.hostId !== playerId) {
        return NextResponse.json({ error: "Only the host can start the game" }, { status: 403 });
      }

      const storedKey = (await getRoomApiKey(roomId)) || apiKey;
      if (!storedKey) {
        return NextResponse.json({ error: "No API key set for this room" }, { status: 400 });
      }

      const currentKey = await getRoomApiKey(roomId);
      if (!currentKey && storedKey) {
        await setRoomApiKey(roomId, storedKey);
      }

      // Await generation so Vercel does not kill the process
      try {
        await startGame(roomId, storedKey);
      } catch (err) {
        console.error(err);
      }
      return NextResponse.json({ ok: true });
    }

    case "guess": {
      if (!playerId || !guess) {
        return NextResponse.json({ error: "Missing guess" }, { status: 400 });
      }

      // Mutating actions must be awaited so KV resolves before return
      try {
        await handleGuess(roomId, playerId, guess);
      } catch (err) {
        console.error(err);
      }
      return NextResponse.json({ ok: true });
    }

    case "next_round": {
      if (!playerId || room.hostId !== playerId) {
        return NextResponse.json({ error: "Only the host can advance rounds" }, { status: 403 });
      }
      try {
        await nextRound(roomId);
      } catch (err) {
        console.error(err);
      }
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
