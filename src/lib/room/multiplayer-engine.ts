import type { WSServerMessage, GameSession } from "@/lib/types";
import { getRoom, setRoomStatus, setRoomSession } from "@/lib/room/manager";
import {
  createGameSession,
  startNextRound,
  processGuess,
  endRound,
  isRoundOver,
  isGameOver,
  getLeaderboard,
} from "@/lib/game/engine";
import { generateGameDataset } from "@/lib/ai/orchestrator";
import { serializeRoom } from "@/lib/utils";
import { deleteRoomApiKey } from "@/lib/room/api-key-store";
import { kvGet, kvSet, isKvEnabled } from "@/lib/kv-store";

// Map serialization helpers
function serializeSession(session: GameSession): any {
  return {
    ...session,
    players: Array.from(session.players.entries()),
    roundState: session.roundState ? {
      ...session.roundState,
      guesses: Array.from(session.roundState.guesses.entries())
    } : null
  };
}

function deserializeSession(data: any): GameSession {
  return {
    ...data,
    players: new Map(data.players),
    roundState: data.roundState ? {
      ...data.roundState,
      guesses: new Map(data.roundState.guesses)
    } : null
  };
}

const g = global as typeof globalThis & {
  __guesswhat_sessions?: Map<string, GameSession>;
  __guesswhat_events?: Map<string, WSServerMessage[]>;
};
if (!g.__guesswhat_sessions) g.__guesswhat_sessions = new Map();
if (!g.__guesswhat_events) g.__guesswhat_events = new Map();
const fallbackSessions = g.__guesswhat_sessions;
const fallbackEvents = g.__guesswhat_events;

async function saveSession(session: GameSession) {
  await kvSet(`session:${session.id}`, serializeSession(session), 3 * 3600);
  if (!isKvEnabled) fallbackSessions.set(session.id, session);
}

async function getSession(sessionId: string): Promise<GameSession | null> {
  const data = await kvGet<any>(`session:${sessionId}`);
  if (data) return deserializeSession(data);
  if (!isKvEnabled) return fallbackSessions.get(sessionId) || null;
  return null;
}

export async function pushEvent(roomId: string, msg: WSServerMessage) {
  let queue: WSServerMessage[] = [];
  if (isKvEnabled) {
    queue = (await kvGet<WSServerMessage[]>(`events:${roomId}`)) || [];
  } else {
    queue = fallbackEvents.get(roomId) || [];
  }

  queue.push(msg);
  if (queue.length > 100) queue.splice(0, queue.length - 100);

  if (isKvEnabled) {
    await kvSet(`events:${roomId}`, queue, 3 * 3600);
  } else {
    fallbackEvents.set(roomId, queue);
  }
}

export async function getEvents(roomId: string, since: number): Promise<{ events: WSServerMessage[]; cursor: number }> {
  // Tick time progress before returning events to make KV completely serverless
  await tickSession(roomId);

  let queue: WSServerMessage[] = [];
  if (isKvEnabled) {
    queue = (await kvGet<WSServerMessage[]>(`events:${roomId}`)) || [];
  } else {
    queue = fallbackEvents.get(roomId) || [];
  }

  if (since >= queue.length) {
    return { events: [], cursor: queue.length };
  }
  return { events: queue.slice(since), cursor: queue.length };
}

export async function getRoomState(roomId: string) {
  const room = await getRoom(roomId);
  if (!room) return null;

  const serialized = serializeRoom(room);
  let roundState = null;

  if (room.sessionId) {
    const session = await getSession(room.sessionId);
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

// True Serverless Game Loop (Lazy Evaluation)
async function tickSession(roomId: string) {
  const room = await getRoom(roomId);
  if (!room || !room.sessionId) return;
  
  const session = await getSession(room.sessionId);
  if (!session || !session.roundState) return;

  const rs = session.roundState;
  const elapsed = (Date.now() - rs.startedAt) / 1000;

  let stateChanged = false;

  // 1. Check for Hints
  const hintInterval = rs.timerSeconds * 0.2;
  const expectedHints = Math.min(3, Math.floor(elapsed / hintInterval));
  
  if (expectedHints > rs.revealedHints) {
    // Reveal all pending hints
    while (rs.revealedHints < expectedHints) {
      rs.revealedHints++;
      await pushEvent(roomId, {
        type: "hint_revealed",
        hintIndex: rs.revealedHints,
        hint: rs.entity.hints[rs.revealedHints - 1],
      });
      stateChanged = true;
    }
  }

  // 2. Check for Round End
  if (elapsed >= rs.timerSeconds) {
    await handleRoundEndInner(roomId, session);
    stateChanged = true;
  }

  if (stateChanged) {
    await saveSession(session);
  }
}

async function handleRoundEndInner(roomId: string, session: GameSession) {
  if (!session.roundState) return;
  
  const result = endRound(session);
  if (!result) return;

  await pushEvent(roomId, {
    type: "round_end",
    scores: result.scores,
    correctAnswer: result.correctAnswer,
    description: result.description,
  });

  if (isGameOver(session)) {
    const finalScores = getLeaderboard(session);
    await pushEvent(roomId, { type: "game_end", finalScores });
    await setRoomStatus(roomId, "finished");
    await deleteRoomApiKey(roomId);
  }
}

export async function startRound(roomId: string, sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return;
  const room = await getRoom(roomId);
  if (!room) return;

  const roundState = startNextRound(session, room.timerSeconds);
  if (!roundState) {
    const finalScores = getLeaderboard(session);
    await pushEvent(roomId, { type: "game_end", finalScores });
    await setRoomStatus(roomId, "finished");
    return;
  }

  await saveSession(session);

  const revealedHints: string[] = [];
  for (let i = 0; i < roundState.revealedHints; i++) {
    revealedHints.push(roundState.entity.hints[i]);
  }

  await pushEvent(roomId, {
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
}

export async function startGame(roomId: string, apiKey: string) {
  const room = await getRoom(roomId);
  if (!room) {
    await pushEvent(roomId, { type: "error", message: "Room not found" });
    return;
  }

  await setRoomStatus(roomId, "generating");
  await pushEvent(roomId, { type: "room_state", room: serializeRoom(room) });

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

    await saveSession(session);
    await setRoomSession(roomId, session.id);
    await setRoomStatus(roomId, "playing");

    await pushEvent(roomId, { type: "game_started", sessionId: session.id });
    await startRound(roomId, session.id);
  } catch (err: unknown) {
    await setRoomStatus(roomId, "lobby");
    const message = err instanceof Error ? err.message : "Failed to generate game";
    await pushEvent(roomId, { type: "error", message });
  }
}

export async function handleGuess(roomId: string, playerId: string, guess: string) {
  const room = await getRoom(roomId);
  if (!room?.sessionId) return;

  const session = await getSession(room.sessionId);
  if (!session) return;

  const player = session.players.get(playerId);
  const result = processGuess(session, playerId, guess);
  if (!result) return;

  await pushEvent(roomId, {
    type: "guess_result",
    playerId,
    playerName: player?.name || "Unknown",
    guess,
    correct: result.correct,
    guessesLeft: result.guessesLeft,
  });

  if (isRoundOver(session)) {
    await handleRoundEndInner(roomId, session);
  }

  await saveSession(session);
}

export async function nextRound(roomId: string) {
  const room = await getRoom(roomId);
  if (!room?.sessionId) return;
  await startRound(roomId, room.sessionId);
}
