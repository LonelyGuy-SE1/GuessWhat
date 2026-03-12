import type { WSServerMessage } from "@/lib/types";
import { getRoom, setRoomStatus, setRoomSession } from "@/lib/room/manager";
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
import { broadcastToRoom } from "@/lib/room/sse-hub";
import { serializeRoom } from "@/lib/utils";
import { deleteRoomApiKey } from "@/lib/room/api-key-store";

const g = global as typeof globalThis & {
  __guesswhat_hintTimers?: Map<string, NodeJS.Timeout>;
  __guesswhat_roundTimers?: Map<string, NodeJS.Timeout>;
};
if (!g.__guesswhat_hintTimers) g.__guesswhat_hintTimers = new Map();
if (!g.__guesswhat_roundTimers) g.__guesswhat_roundTimers = new Map();
const hintTimers = g.__guesswhat_hintTimers;
const roundTimers = g.__guesswhat_roundTimers;

function serializeRoundForClients(sessionId: string) {
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

function clearTimers(sessionId: string) {
  const ht = hintTimers.get(sessionId);
  if (ht) {
    clearInterval(ht);
    hintTimers.delete(sessionId);
  }
  const rt = roundTimers.get(sessionId);
  if (rt) {
    clearTimeout(rt);
    roundTimers.delete(sessionId);
  }
}

function scheduleHints(roomId: string, sessionId: string, timerSeconds: number) {
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
    deleteRoomApiKey(roomId);
  }
}

export function startRound(roomId: string, sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return;
  const room = getRoom(roomId);
  if (!room) return;

  const roundState = startNextRound(sessionId, room.timerSeconds);
  if (!roundState) {
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

export async function startGame(roomId: string, apiKey: string) {
  const room = getRoom(roomId);
  if (!room) {
    const msg: WSServerMessage = { type: "error", message: "Room not found" };
    broadcastToRoom(roomId, msg);
    return;
  }

  setRoomStatus(roomId, "generating");
  broadcastToRoom(roomId, { type: "room_state", room: serializeRoom(room) });

  try {
    const dataset = await generateGameDataset(apiKey, room.topic, room.difficulty, room.totalRounds);
    const session = createGameSession(
      dataset,
      "multiplayer",
      room.difficulty,
      room.totalRounds,
      room.timerSeconds
    );

    for (const [id, player] of room.players) {
      session.players.set(id, { ...player, score: 0 });
    }

    setRoomSession(roomId, session.id);
    setRoomStatus(roomId, "playing");

    broadcastToRoom(roomId, { type: "game_started", sessionId: session.id });
    startRound(roomId, session.id);
  } catch (err: unknown) {
    setRoomStatus(roomId, "lobby");
    const message = err instanceof Error ? err.message : "Failed to generate game";
    broadcastToRoom(roomId, { type: "error", message });
  }
}

export function handleGuess(roomId: string, playerId: string, guess: string) {
  const room = getRoom(roomId);
  if (!room?.sessionId) return;

  const result = processGuess(room.sessionId, playerId, guess);
  if (!result) return;

  broadcastToRoom(roomId, {
    type: "guess_result",
    playerId,
    correct: result.correct,
    guessesLeft: result.guessesLeft,
  });

  if (isRoundOver(room.sessionId)) {
    handleRoundEnd(roomId, room.sessionId);
  }
}

export function nextRound(roomId: string) {
  const room = getRoom(roomId);
  if (!room?.sessionId) return;
  startRound(roomId, room.sessionId);
}
