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
import { serializeRoom, answerToPattern } from "@/lib/utils";
import { deleteRoomApiKey } from "@/lib/room/api-key-store";
import { kvGet, kvSet, kvListAppend, kvListRange } from "@/lib/kv-store";

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

const SESSION_TTL = 3 * 3600;
const EVENTS_TTL = 3 * 3600;

async function saveSession(session: GameSession) {
  await kvSet(`session:${session.id}`, serializeSession(session), SESSION_TTL);
}

async function getSession(sessionId: string): Promise<GameSession | null> {
  const data = await kvGet<any>(`session:${sessionId}`);
  if (data) return deserializeSession(data);
  return null;
}

export async function pushEvent(roomId: string, msg: WSServerMessage) {
  await kvListAppend(`events:${roomId}`, msg, EVENTS_TTL);
}

export async function getEvents(roomId: string, since: number): Promise<{ events: WSServerMessage[]; cursor: number }> {
  // Tick time progress before returning events (serverless game loop)
  await tickSession(roomId);

  const events = await kvListRange(`events:${roomId}`, since);
  return { events, cursor: since + events.length };
}

export async function getRoomState(roomId: string) {
  const room = await getRoom(roomId);
  if (!room) return null;

  const serialized = serializeRoom(room);
  let roundState = null;
  let currentRound = 0;
  let totalRounds = 0;

  if (room.sessionId) {
    const session = await getSession(room.sessionId);
    if (session) {
      currentRound = session.currentRound;
      totalRounds = session.totalRounds;
      if (session.roundState) {
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
          answerPattern: answerToPattern(rs.entity.name),
        };
      }
    }
  }

  return { room: serialized, roundState, currentRound, totalRounds };
}

// True Serverless Game Loop (Lazy Evaluation)
// Called on every poll to advance game state based on elapsed time
async function tickSession(roomId: string) {
  const room = await getRoom(roomId);
  if (!room || !room.sessionId) return;
  
  const session = await getSession(room.sessionId);
  if (!session || !session.roundState) return;

  const rs = session.roundState;
  const elapsed = (Date.now() - rs.startedAt) / 1000;

  let stateChanged = false;

  // 1. Check for time-based hint reveals
  const hintInterval = rs.timerSeconds * 0.2;
  const expectedHints = Math.min(3, Math.floor(elapsed / hintInterval));
  
  if (expectedHints > rs.revealedHints) {
    while (rs.revealedHints < expectedHints) {
      const hintIndex = rs.revealedHints;
      rs.revealedHints++;
      await pushEvent(roomId, {
        type: "hint_revealed",
        hintIndex,
        hint: rs.entity.hints[hintIndex],
      });
      stateChanged = true;
    }
  }

  // 2. Check for timer expiration -> end round
  if (elapsed >= rs.timerSeconds && session.roundState) {
    await handleRoundEndInner(roomId, session);
    stateChanged = true;
  }

  if (stateChanged) {
    await saveSession(session);
  }
}

async function handleRoundEndInner(roomId: string, session: GameSession) {
  // Guard: if round already ended (e.g., by a concurrent request), bail out
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

  // Guard: if a round is already in progress, ignore (prevents double-click issues)
  if (session.roundState) return;

  // Guard: if all rounds are done, don't start another (prevents premature game_end from duplicate calls)
  if (session.currentRound >= session.totalRounds) return;

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
      answerPattern: answerToPattern(roundState.entity.name),
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
  // Re-fetch room after status update to get fresh state for serialization
  const updatedRoom = await getRoom(roomId);
  if (updatedRoom) {
    await pushEvent(roomId, { type: "room_state", room: serializeRoom(updatedRoom) });
  }

  try {
    const dataset = await generateGameDataset(apiKey, room.topic, room.difficulty, room.totalRounds);
    const session = createGameSession(
      dataset,
      "multiplayer",
      room.difficulty,
      room.totalRounds,
      room.timerSeconds
    );

    // Re-fetch room to get latest player list (players may have joined during generation)
    const latestRoom = await getRoom(roomId);
    const players = latestRoom ? latestRoom.players : room.players;
    
    for (const [id, player] of players) {
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
    // Redact the guess text when correct so other players can't see the answer
    guess: result.correct ? "" : guess,
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
