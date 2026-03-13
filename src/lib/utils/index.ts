import { v4 as uuidv4 } from "uuid";
import type { SerializedPlayer, SerializedRoom, Room, Player, Difficulty } from "@/lib/types";

export function generateId(): string {
  return uuidv4();
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function serializeRoom(room: Room): SerializedRoom {
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    topic: room.topic,
    difficulty: room.difficulty,
    totalRounds: room.totalRounds,
    timerSeconds: room.timerSeconds,
    maxPlayers: room.maxPlayers,
    players: serializePlayers(room.players),
    sessionId: room.sessionId,
    status: room.status,
    createdAt: room.createdAt,
  };
}

export function serializePlayers(players: Map<string, Player>): SerializedPlayer[] {
  return Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    connected: p.connected,
  }));
}

export function calculateRoundScore(
  difficulty: Difficulty,
  guessesUsed: number,
  hintsRevealed: number,
  timeRemainingPct: number
): number {
  const basePoints: Record<Difficulty, number> = { easy: 100, medium: 200, hard: 300 };
  const base = basePoints[difficulty];
  const guessPenalty = (guessesUsed - 1) * 0.2;
  const hintPenalty = hintsRevealed * 0.15;
  const timeBonus = timeRemainingPct * 0.3;
  return Math.max(10, Math.round(base * (1 - guessPenalty - hintPenalty + timeBonus)));
}

function normalizeGuess(guess: string): string {
  return guess.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

export function checkGuess(guess: string, answer: string, acceptedAnswers?: string[]): boolean {
  const g = normalizeGuess(guess);
  const a = normalizeGuess(answer);
  
  if (!g) return false;
  if (g === a) return true;

  // Check accepted answers (exact or fuzzy)
  if (acceptedAnswers && acceptedAnswers.length > 0) {
    for (const alt of acceptedAnswers) {
      const altNorm = normalizeGuess(alt);
      if (!altNorm) continue;
      if (g === altNorm) return true;
      // Substring match with relaxed threshold
      if (altNorm.includes(g) && g.length >= altNorm.length * 0.5) return true;
      if (g.includes(altNorm) && altNorm.length >= g.length * 0.5) return true;
    }
  }

  // Direct substring match with relaxed threshold
  if (a.includes(g) && g.length >= a.length * 0.4) return true;
  if (g.includes(a) && a.length >= g.length * 0.4) return true;

  // Word-level matching: if the guess matches any significant word(s) in the answer
  const aWords = a.split(/\s+/).filter(w => w.length > 2); // skip "of", "the", etc.
  const gWords = g.split(/\s+/).filter(w => w.length > 2);

  // If the guess IS one of the significant words in the answer (e.g. "bhutan" in "flag of bhutan")
  for (const aw of aWords) {
    if (g === aw) return true;
    // Typo tolerance: allow 1-2 char difference for longer words
    if (aw.length >= 5 && levenshtein(g, aw) <= 1) return true;
    if (aw.length >= 8 && levenshtein(g, aw) <= 2) return true;
  }

  // If any significant word in the guess matches a significant word in the answer
  for (const gw of gWords) {
    for (const aw of aWords) {
      if (gw === aw) return true;
      if (aw.length >= 5 && levenshtein(gw, aw) <= 1) return true;
    }
  }

  // Levenshtein on full string for typo tolerance
  if (a.length >= 4 && levenshtein(g, a) <= 1) return true;
  if (a.length >= 8 && levenshtein(g, a) <= 2) return true;

  return false;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function answerToPattern(answer: string): number[] {
  return answer.trim().split(/\s+/).map((w) => w.length);
}
