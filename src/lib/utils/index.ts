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

export function difficultyTimerSeconds(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy": return 45;
    case "medium": return 30;
    case "hard": return 20;
  }
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

export function normalizeGuess(guess: string): string {
  return guess.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

export function checkGuess(guess: string, answer: string, acceptedAnswers?: string[]): boolean {
  const g = normalizeGuess(guess);
  const a = normalizeGuess(answer);
  if (g === a) return true;
  
  if (acceptedAnswers && acceptedAnswers.length > 0) {
    for (const alt of acceptedAnswers) {
      const altNorm = normalizeGuess(alt);
      if (g === altNorm) return true;
      if (altNorm.includes(g) && g.length >= altNorm.length * 0.6) return true;
      if (g.includes(altNorm) && altNorm.length >= g.length * 0.6) return true;
    }
  }

  // Allow partial match if sufficiently close
  if (a.includes(g) && g.length >= a.length * 0.6) return true;
  if (g.includes(a) && a.length >= g.length * 0.6) return true;
  return false;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
