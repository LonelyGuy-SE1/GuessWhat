import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/game/session-store";
import {
  startNextRound,
  processGuess,
  endRound,
  revealHint,
  isRoundOver,
  isGameOver,
  getLeaderboard,
} from "@/lib/game/engine";
import type { Difficulty } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const roundState = session.roundState
    ? {
        roundNumber: session.roundState.roundNumber,
        imageUrl: session.roundState.entity.imageUrl,
        startedAt: session.roundState.startedAt,
        timerSeconds: session.roundState.timerSeconds,
        revealedHints: session.roundState.revealedHints,
        hints: session.roundState.entity.hints.slice(0, session.roundState.revealedHints),
      }
    : null;

  return NextResponse.json({
    sessionId: session.id,
    currentRound: session.currentRound,
    totalRounds: session.totalRounds,
    status: session.status,
    roundState,
    leaderboard: getLeaderboard(sessionId),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json();
  const { action, playerId, guess } = body as {
    action: "start_round" | "guess" | "reveal_hint" | "end_round";
    playerId: string;
    guess?: string;
  };

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  switch (action) {
    case "start_round": {
      const timerMap: Record<Difficulty, number> = { easy: 45, medium: 30, hard: 20 };
      const roundState = startNextRound(sessionId, timerMap[session.difficulty]);
      if (!roundState) {
        if (isGameOver(sessionId)) {
          return NextResponse.json({
            action: "game_over",
            finalScores: getLeaderboard(sessionId),
          });
        }
        return NextResponse.json({ error: "Cannot start round" }, { status: 400 });
      }

      return NextResponse.json({
        action: "round_started",
        roundNumber: roundState.roundNumber,
        imageUrl: roundState.entity.imageUrl,
        timerSeconds: roundState.timerSeconds,
        totalRounds: session.totalRounds,
      });
    }

    case "guess": {
      if (!guess) {
        return NextResponse.json({ error: "Missing guess" }, { status: 400 });
      }

      const result = processGuess(sessionId, playerId, guess);
      if (!result) {
        return NextResponse.json({ error: "Cannot process guess" }, { status: 400 });
      }

      const roundOver = isRoundOver(sessionId);

      return NextResponse.json({
        action: "guess_result",
        correct: result.correct,
        guessesLeft: result.guessesLeft,
        score: result.score,
        roundOver,
      });
    }

    case "reveal_hint": {
      const result = revealHint(sessionId);
      if (!result) {
        return NextResponse.json({ error: "No more hints" }, { status: 400 });
      }

      return NextResponse.json({
        action: "hint_revealed",
        hintIndex: result.hintIndex,
        hint: result.hint,
      });
    }

    case "end_round": {
      const result = endRound(sessionId);
      if (!result) {
        return NextResponse.json({ error: "Cannot end round" }, { status: 400 });
      }

      return NextResponse.json({
        action: "round_ended",
        ...result,
        gameOver: isGameOver(sessionId),
      });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
