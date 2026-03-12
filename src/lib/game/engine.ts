import type {
  GameSession,
  GameDataset,
  Player,
  RoundState,
  PlayerRoundState,
  PlayerScore,
  Difficulty,
} from "@/lib/types";
import { generateId, calculateRoundScore, checkGuess } from "@/lib/utils";
import { getSession, setSession } from "./session-store";

export function createGameSession(
  dataset: GameDataset,
  mode: "solo" | "multiplayer",
  difficulty: Difficulty,
  totalRounds: number,
  timerSeconds: number,
  playerName?: string
): GameSession {
  const session: GameSession = {
    id: generateId(),
    dataset,
    currentRound: 0,
    totalRounds: Math.min(totalRounds, dataset.entities.length),
    mode,
    difficulty,
    players: new Map(),
    roundState: null,
    status: "waiting",
    createdAt: Date.now(),
  };

  if (playerName) {
    const player = createPlayer(playerName);
    session.players.set(player.id, player);
  }

  setSession(session);
  return session;
}

export function createPlayer(name: string): Player {
  return {
    id: generateId(),
    name,
    score: 0,
    connected: true,
  };
}

export function startNextRound(sessionId: string, timerSeconds: number): RoundState | null {
  const session = getSession(sessionId);
  if (!session) return null;

  if (session.currentRound >= session.totalRounds) {
    session.status = "finished";
    setSession(session);
    return null;
  }

  const entity = session.dataset.entities[session.currentRound];
  if (!entity) return null;

  const roundState: RoundState = {
    roundNumber: session.currentRound + 1,
    entity,
    startedAt: Date.now(),
    timerSeconds,
    revealedHints: 0,
    guesses: new Map(),
  };

  // Initialize player round state
  for (const [playerId] of session.players) {
    roundState.guesses.set(playerId, {
      guessesUsed: 0,
      guessedCorrectly: false,
      score: 0,
    });
  }

  session.roundState = roundState;
  session.status = "playing";
  session.currentRound++;
  setSession(session);

  return roundState;
}

export function revealHint(sessionId: string): { hintIndex: number; hint: string } | null {
  const session = getSession(sessionId);
  if (!session?.roundState) return null;

  const rs = session.roundState;
  if (rs.revealedHints >= 3) return null;

  const hintIndex = rs.revealedHints;
  rs.revealedHints++;
  setSession(session);

  return { hintIndex, hint: rs.entity.hints[hintIndex] };
}

export function processGuess(
  sessionId: string,
  playerId: string,
  guess: string
): { correct: boolean; guessesLeft: number; score: number } | null {
  const session = getSession(sessionId);
  if (!session?.roundState) return null;

  const rs = session.roundState;
  const playerState = rs.guesses.get(playerId);
  if (!playerState) return null;

  // Player already got it right or used all guesses
  if (playerState.guessedCorrectly || playerState.guessesUsed >= 3) {
    return { correct: playerState.guessedCorrectly, guessesLeft: 0, score: playerState.score };
  }

  playerState.guessesUsed++;
  const correct = checkGuess(guess, rs.entity.name);

  if (correct) {
    playerState.guessedCorrectly = true;
    const elapsed = (Date.now() - rs.startedAt) / 1000;
    const timeRemPct = Math.max(0, (rs.timerSeconds - elapsed) / rs.timerSeconds);
    playerState.score = calculateRoundScore(
      session.difficulty,
      playerState.guessesUsed,
      rs.revealedHints,
      timeRemPct
    );

    // Update player total score
    const player = session.players.get(playerId);
    if (player) {
      player.score += playerState.score;
    }
  }

  setSession(session);

  return {
    correct,
    guessesLeft: 3 - playerState.guessesUsed,
    score: playerState.score,
  };
}

export function endRound(sessionId: string): {
  scores: PlayerScore[];
  correctAnswer: string;
  description: string;
} | null {
  const session = getSession(sessionId);
  if (!session?.roundState) return null;

  const rs = session.roundState;
  const scores: PlayerScore[] = [];

  for (const [playerId, playerState] of rs.guesses) {
    const player = session.players.get(playerId);
    if (player) {
      scores.push({
        playerId,
        playerName: player.name,
        score: player.score,
        roundScore: playerState.score,
      });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  session.roundState = null;
  setSession(session);

  return {
    scores,
    correctAnswer: rs.entity.name,
    description: rs.entity.description,
  };
}

export function getLeaderboard(sessionId: string): PlayerScore[] {
  const session = getSession(sessionId);
  if (!session) return [];

  const scores: PlayerScore[] = [];
  for (const [, player] of session.players) {
    scores.push({
      playerId: player.id,
      playerName: player.name,
      score: player.score,
      roundScore: 0,
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

export function isRoundOver(sessionId: string): boolean {
  const session = getSession(sessionId);
  if (!session?.roundState) return true;

  const rs = session.roundState;

  // Check if all players have guessed or run out of guesses
  let allDone = true;
  for (const [, state] of rs.guesses) {
    if (!state.guessedCorrectly && state.guessesUsed < 3) {
      allDone = false;
      break;
    }
  }

  if (allDone) return true;

  // Check if timer expired
  const elapsed = (Date.now() - rs.startedAt) / 1000;
  return elapsed >= rs.timerSeconds;
}

export function isGameOver(sessionId: string): boolean {
  const session = getSession(sessionId);
  if (!session) return true;
  return session.currentRound >= session.totalRounds && !session.roundState;
}
