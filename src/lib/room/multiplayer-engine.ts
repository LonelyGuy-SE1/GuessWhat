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
import { generateGameDataset } from "@/lib/ai/orchestrator";
import { serializeRoom } from "@/lib/utils";
import { deleteRoomApiKey } from "@/lib/room/api-key-store";

const g = global as typeof globalThis & {
  __guesswhat_hintTimers?: Map<string, ReturnType<typeof setInterval>>;
  __guesswhat_roundTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __guesswhat_sessions?: Map<string, import("@/lib/types").GameSession>;
  __guesswhat_events?: Map<string, WSServerMessage[]>;
};
if (!g.__guesswhat_hintTimers) g.__guesswhat_hintTimers = new Map();
if (!g.__guesswhat_roundTimers) g.__guesswhat_roundTimers = new Map();
if (!g.__guesswhat_sessions) g.__guesswhat_sessions = new Map();
if (!g.__guesswhat_events) g.__guesswhat_events = new Map();
const hintTimers = g.__guesswhat_hintTimers;
const roundTimers = g.__guesswhat_roundTimers;
const sessions = g.__guesswhat_sessions;
const eventQueues = g.__guesswhat_events;

function getSessionLocal(sessionId: string) {
  return sessions.get(sessionId);
}

export function pushEvent(roomId: string, msg: WSServerMessage) {
  if (!eventQueues.has(roomId)) {
    eventQueues.set(roomId, []);
  }
  const queue = eventQueues.get(roomId)!;
  queue.push(msg);
  if (queue.length > 100) {
    queue.splice(0, queue.length - 100);
  }
}

export function getEvents(roomId: string, since: number): { events: WSServerMessage[]; cursor: number } {
  const queue = eventQueues.get(roomId);
  if (!queue || since >= queue.length) {
    return { events: [], cursor: queue?.length ?? 0 };
  }
  return { events: queue.slice(since), cursor: queue.length };
}

export function getRoomState(roomId: string) {
  const room = getRoom(roomId);
  if (!room) return null;

  const serialized = serializeRoom(room);
  let roundState = null;

  if (room.sessionId) {
    const session = getSessionLocal(room.sessionId);
    if (session?.roundState) {
      const rs = session.roundState;
      const revealedHints: string[] = [];
      for (let i = 0; i < rs.revealedHints; i++) {
        revealedHints.push(rs.entity.hints[i]);
      }
      roundState = {
        roundNumber: rs.roundNumber,
        imageUrl: rs.entity.imageUrl,
        startedAt: rs.startedAt,
        timerSeconds: rs.timerSeconds,
        revealedHints: rs.revealedHints,
        hints: revealedHints,
      };
    }
  }

  return { room: serialized, roundState, currentRound: 0, totalRounds: 0 };
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

    const session = getSessionLocal(sessionId);
    if (!session) return;
    const result = revealHint(session);
    if (result) {
      pushEvent(roomId, {
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

  const session = getSessionLocal(sessionId);
  if (!session) return;

  const result = endRound(session);
  if (!result) return;

  pushEvent(roomId, {
    type: "round_end",
    scores: result.scores,
    correctAnswer: result.correctAnswer,
    description: result.description,
  });

  if (isGameOver(session)) {
    const finalScores = getLeaderboard(session);
    pushEvent(roomId, { type: "game_end", finalScores });
    setRoomStatus(roomId, "finished");
    deleteRoomApiKey(roomId);
  }
}

export function startRound(roomId: string, sessionId: string) {
  const session = getSessionLocal(sessionId);
  if (!session) return;
  const room = getRoom(roomId);
  if (!room) return;

  const roundState = startNextRound(session, room.timerSeconds);
  if (!roundState) {
    const finalScores = getLeaderboard(session);
    pushEvent(roomId, { type: "game_end", finalScores });
    setRoomStatus(roomId, "finished");
    return;
  }

  const revealedHints: string[] = [];
  for (let i = 0; i < roundState.revealedHints; i++) {
    revealedHints.push(roundState.entity.hints[i]);
  }

  pushEvent(roomId, {
    type: "round_start",
    round: {
      roundNumber: roundState.roundNumber,
      imageUrl: roundState.entity.imageUrl,
      startedAt: roundState.startedAt,
      timerSeconds: roundState.timerSeconds,
      revealedHints: roundState.revealedHints,
      hints: revealedHints,
    },
    roundNumber: session.currentRound,
    totalRounds: session.totalRounds,
  });

  scheduleHints(roomId, sessionId, room.timerSeconds);
  scheduleRoundEnd(roomId, sessionId, room.timerSeconds);
}

export async function startGame(roomId: string, apiKey: string) {
  const room = getRoom(roomId);
  if (!room) {
    pushEvent(roomId, { type: "error", message: "Room not found" });
    return;
  }

  setRoomStatus(roomId, "generating");
  pushEvent(roomId, { type: "room_state", room: serializeRoom(room) });

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

    sessions.set(session.id, session);
    setRoomSession(roomId, session.id);
    setRoomStatus(roomId, "playing");

    pushEvent(roomId, { type: "game_started", sessionId: session.id });
    startRound(roomId, session.id);
  } catch (err: unknown) {
    setRoomStatus(roomId, "lobby");
    const message = err instanceof Error ? err.message : "Failed to generate game";
    pushEvent(roomId, { type: "error", message });
  }
}

export function handleGuess(roomId: string, playerId: string, guess: string) {
  const room = getRoom(roomId);
  if (!room?.sessionId) return;

  const session = getSessionLocal(room.sessionId);
  if (!session) return;

  const result = processGuess(session, playerId, guess);
  if (!result) return;

  pushEvent(roomId, {
    type: "guess_result",
    playerId,
    correct: result.correct,
    guessesLeft: result.guessesLeft,
  });

  if (isRoundOver(session)) {
    handleRoundEnd(roomId, room.sessionId);
  }
}

export function nextRound(roomId: string) {
  const room = getRoom(roomId);
  if (!room?.sessionId) return;
  startRound(roomId, room.sessionId);
}
