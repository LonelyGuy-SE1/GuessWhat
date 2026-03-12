import type { WebSocket } from "ws";
import type { WSClientMessage, WSServerMessage, SerializedRoundState } from "@/lib/types";
import {
  getRoom,
  joinRoom,
  removePlayer,
  setRoomStatus,
  setRoomSession,
} from "@/lib/room/manager";
import {
  createGameSession,
  startNextRound,
  processGuess,
  endRound,
  revealHint,
  isRoundOver,
  isGameOver,
  getLeaderboard,
} from "@/lib/game/engine";
import { getSession } from "@/lib/game/session-store";
import { generateGameDataset } from "@/lib/ai/orchestrator";
import { serializeRoom } from "@/lib/utils";

// ─── Connection Registry ───

interface PlayerConnection {
  ws: WebSocket;
  playerId: string;
  roomId: string;
}

const connections = new Map<WebSocket, PlayerConnection>();
const roomConnections = new Map<string, Set<WebSocket>>();

// ─── API key store (per room, in memory only) ───
const roomApiKeys = new Map<string, string>();

export function setRoomApiKey(roomId: string, apiKey: string) {
  roomApiKeys.set(roomId, apiKey);
}

// ─── Hint timer registry ───
const hintTimers = new Map<string, NodeJS.Timeout>();
const roundTimers = new Map<string, NodeJS.Timeout>();

function send(ws: WebSocket, msg: WSServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastToRoom(roomId: string, msg: WSServerMessage) {
  const sockets = roomConnections.get(roomId);
  if (!sockets) return;
  const data = JSON.stringify(msg);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

function serializeRoundForClients(sessionId: string): SerializedRoundState | null {
  const session = getSession(sessionId);
  if (!session?.roundState) return null;
  const rs = session.roundState;
  const revealedHints: string[] = [];
  for (let i = 0; i < rs.revealedHints; i++) {
    revealedHints.push(rs.entity.hints[i]);
  }
  return {
    roundNumber: rs.roundNumber,
    imageUrl: rs.entity.imageUrl,
    startedAt: rs.startedAt,
    timerSeconds: rs.timerSeconds,
    revealedHints: rs.revealedHints,
    hints: revealedHints,
  };
}

function scheduleHints(roomId: string, sessionId: string, timerSeconds: number) {
  // Reveal hints at 1/3 and 2/3 of the timer
  const interval = (timerSeconds * 1000) / 3;

  let hintCount = 0;
  const timer = setInterval(() => {
    hintCount++;
    if (hintCount > 2) {
      clearInterval(timer);
      hintTimers.delete(sessionId);
      return;
    }

    const result = revealHint(sessionId);
    if (result) {
      broadcastToRoom(roomId, {
        type: "hint_revealed",
        hintIndex: result.hintIndex,
        hint: result.hint,
      });
    }
  }, interval);

  hintTimers.set(sessionId, timer);
}

function scheduleRoundEnd(roomId: string, sessionId: string, timerSeconds: number) {
  const timer = setTimeout(() => {
    roundTimers.delete(sessionId);
    handleRoundEnd(roomId, sessionId);
  }, timerSeconds * 1000);

  roundTimers.set(sessionId, timer);
}

function clearTimers(sessionId: string) {
  const ht = hintTimers.get(sessionId);
  if (ht) { clearInterval(ht); hintTimers.delete(sessionId); }
  const rt = roundTimers.get(sessionId);
  if (rt) { clearTimeout(rt); roundTimers.delete(sessionId); }
}

function handleRoundEnd(roomId: string, sessionId: string) {
  clearTimers(sessionId);

  const result = endRound(sessionId);
  if (!result) return;

  broadcastToRoom(roomId, {
    type: "round_end",
    scores: result.scores,
    correctAnswer: result.correctAnswer,
    description: result.description,
  });

  if (isGameOver(sessionId)) {
    const finalScores = getLeaderboard(sessionId);
    broadcastToRoom(roomId, { type: "game_end", finalScores });
    setRoomStatus(roomId, "finished");
    roomApiKeys.delete(roomId);
  }
}

function startRound(roomId: string, sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return;

  const room = getRoom(roomId);
  if (!room) return;

  const roundState = startNextRound(sessionId, room.timerSeconds);
  if (!roundState) {
    // No more rounds
    const finalScores = getLeaderboard(sessionId);
    broadcastToRoom(roomId, { type: "game_end", finalScores });
    setRoomStatus(roomId, "finished");
    return;
  }

  const serialized = serializeRoundForClients(sessionId);
  if (serialized) {
    broadcastToRoom(roomId, {
      type: "round_start",
      round: serialized,
      roundNumber: session.currentRound,
      totalRounds: session.totalRounds,
    });
  }

  scheduleHints(roomId, sessionId, room.timerSeconds);
  scheduleRoundEnd(roomId, sessionId, room.timerSeconds);
}

// ─── Message Handler ───

export async function handleMessage(ws: WebSocket, raw: string) {
  let msg: WSClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    send(ws, { type: "error", message: "Invalid message format" });
    return;
  }

  switch (msg.type) {
    case "ping":
      send(ws, { type: "pong" });
      break;

    case "join_room": {
      const room = getRoom(msg.roomId);
      if (!room) {
        send(ws, { type: "error", message: "Room not found" });
        return;
      }

      // Re-join with existing playerId (host or reconnect)
      if (msg.playerId) {
        const existing = room.players.get(msg.playerId);
        if (existing) {
          existing.connected = true;
          connections.set(ws, { ws, playerId: existing.id, roomId: msg.roomId });
          if (!roomConnections.has(msg.roomId)) {
            roomConnections.set(msg.roomId, new Set());
          }
          roomConnections.get(msg.roomId)!.add(ws);

          broadcastToRoom(msg.roomId, {
            type: "player_joined",
            player: {
              id: existing.id,
              name: existing.name,
              score: existing.score,
              connected: true,
            },
          });

          send(ws, { type: "room_state", room: serializeRoom(room) });
          return;
        }
      }

      const result = joinRoom(msg.roomId, msg.playerName);
      if (!result) {
        send(ws, { type: "error", message: "Cannot join room. It may be full, in progress, or not found." });
        return;
      }

      // Register connection
      connections.set(ws, { ws, playerId: result.player.id, roomId: msg.roomId });
      if (!roomConnections.has(msg.roomId)) {
        roomConnections.set(msg.roomId, new Set());
      }
      roomConnections.get(msg.roomId)!.add(ws);

      // Notify all players
      broadcastToRoom(msg.roomId, {
        type: "player_joined",
        player: {
          id: result.player.id,
          name: result.player.name,
          score: 0,
          connected: true,
        },
      });

      // Send room state to the new player
      send(ws, { type: "room_state", room: serializeRoom(result.room) });
      break;
    }

    case "start_game": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not connected to a room" }); return; }

      const room = getRoom(msg.roomId);
      if (!room) { send(ws, { type: "error", message: "Room not found" }); return; }
      if (room.hostId !== conn.playerId) { send(ws, { type: "error", message: "Only the host can start the game" }); return; }

      const apiKey = roomApiKeys.get(msg.roomId);
      if (!apiKey) { send(ws, { type: "error", message: "No API key set for this room" }); return; }

      setRoomStatus(msg.roomId, "generating");
      broadcastToRoom(msg.roomId, { type: "room_state", room: serializeRoom(getRoom(msg.roomId)!) });

      try {
        const dataset = await generateGameDataset(apiKey, room.topic, room.difficulty, room.totalRounds + 5);

        const session = createGameSession(
          dataset,
          "multiplayer",
          room.difficulty,
          room.totalRounds,
          room.timerSeconds
        );

        // Copy players from room to session
        for (const [id, player] of room.players) {
          session.players.set(id, { ...player, score: 0 });
        }

        setRoomSession(msg.roomId, session.id);
        setRoomStatus(msg.roomId, "playing");

        broadcastToRoom(msg.roomId, { type: "game_started", sessionId: session.id });

        // Start first round
        startRound(msg.roomId, session.id);
      } catch (err: unknown) {
        setRoomStatus(msg.roomId, "lobby");
        const message = err instanceof Error ? err.message : "Failed to generate game";
        broadcastToRoom(msg.roomId, { type: "error", message });
      }
      break;
    }

    case "guess": {
      const conn = connections.get(ws);
      if (!conn) { send(ws, { type: "error", message: "Not connected" }); return; }

      const room = getRoom(msg.roomId);
      if (!room?.sessionId) { send(ws, { type: "error", message: "No active game" }); return; }

      const result = processGuess(room.sessionId, conn.playerId, msg.guess);
      if (!result) { send(ws, { type: "error", message: "Cannot process guess" }); return; }

      broadcastToRoom(msg.roomId, {
        type: "guess_result",
        playerId: conn.playerId,
        correct: result.correct,
        guessesLeft: result.guessesLeft,
      });

      // Check if round should end
      if (isRoundOver(room.sessionId)) {
        handleRoundEnd(msg.roomId, room.sessionId);
      }
      break;
    }

    case "next_round": {
      const conn = connections.get(ws);
      if (!conn) return;

      const room = getRoom(msg.roomId);
      if (!room?.sessionId) return;
      if (room.hostId !== conn.playerId) {
        send(ws, { type: "error", message: "Only the host can advance rounds" });
        return;
      }

      startRound(msg.roomId, room.sessionId);
      break;
    }
  }
}

export function handleDisconnect(ws: WebSocket) {
  const conn = connections.get(ws);
  if (!conn) return;

  const room = getRoom(conn.roomId);
  if (room) {
    const player = room.players.get(conn.playerId);
    if (player) {
      player.connected = false;
    }

    broadcastToRoom(conn.roomId, { type: "player_left", playerId: conn.playerId });

    // If all players disconnected, clean up
    let anyConnected = false;
    for (const [, p] of room.players) {
      if (p.connected) { anyConnected = true; break; }
    }
    if (!anyConnected) {
      if (room.sessionId) clearTimers(room.sessionId);
      roomApiKeys.delete(conn.roomId);
    }
  }

  const roomSockets = roomConnections.get(conn.roomId);
  if (roomSockets) {
    roomSockets.delete(ws);
    if (roomSockets.size === 0) {
      roomConnections.delete(conn.roomId);
    }
  }

  connections.delete(ws);
}

// Allow host to register their connection without "joining"
export function registerHostConnection(ws: WebSocket, playerId: string, roomId: string) {
  connections.set(ws, { ws, playerId, roomId });
  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, new Set());
  }
  roomConnections.get(roomId)!.add(ws);
}
