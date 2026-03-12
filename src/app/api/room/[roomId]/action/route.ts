import { NextRequest, NextResponse } from "next/server";
import { getRoom, joinRoom } from "@/lib/room/manager";
import { serializeRoom } from "@/lib/utils";
import { getRoomApiKey } from "@/lib/room/api-key-store";
import { startGame, handleGuess, nextRound, pushEvent } from "@/lib/room/multiplayer-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await req.json();
  const { action, playerName, playerId, guess } = body as {
    action: "join" | "start_game" | "guess" | "next_round";
    playerName?: string;
    playerId?: string;
    guess?: string;
  };

  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  switch (action) {
    case "join": {
      if (playerId) {
        const existing = room.players.get(playerId);
        if (existing) {
          existing.connected = true;
          pushEvent(roomId, { type: "room_state", room: serializeRoom(room) });
          return NextResponse.json({ playerId: existing.id, room: serializeRoom(room) });
        }
      }

      if (!playerName) {
        return NextResponse.json({ error: "Missing player name" }, { status: 400 });
      }

      const result = joinRoom(roomId, playerName);
      if (!result) {
        return NextResponse.json({ error: "Cannot join room" }, { status: 400 });
      }

      pushEvent(roomId, {
        type: "player_joined",
        player: {
          id: result.player.id,
          name: result.player.name,
          score: 0,
          connected: true,
        },
      });

      pushEvent(roomId, { type: "room_state", room: serializeRoom(result.room) });

      return NextResponse.json({ playerId: result.player.id, room: serializeRoom(result.room) });
    }

    case "start_game": {
      if (!playerId || room.hostId !== playerId) {
        return NextResponse.json({ error: "Only the host can start the game" }, { status: 403 });
      }

      const apiKey = getRoomApiKey(roomId);
      if (!apiKey) {
        return NextResponse.json({ error: "No API key set for this room" }, { status: 400 });
      }

      startGame(roomId, apiKey);
      return NextResponse.json({ ok: true });
    }

    case "guess": {
      if (!playerId || !guess) {
        return NextResponse.json({ error: "Missing guess" }, { status: 400 });
      }

      handleGuess(roomId, playerId, guess);
      return NextResponse.json({ ok: true });
    }

    case "next_round": {
      if (!playerId || room.hostId !== playerId) {
        return NextResponse.json({ error: "Only the host can advance rounds" }, { status: 403 });
      }
      nextRound(roomId);
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
