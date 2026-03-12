"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameSession, GameDataset, Difficulty } from "@/lib/types";
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

interface UseSoloGameOptions {
  dataset: GameDataset;
  playerName: string;
  difficulty: Difficulty;
  rounds: number;
}

interface RoundData {
  roundNumber: number;
  imageUrl: string;
  timerSeconds: number;
  totalRounds: number;
}

interface RoundEndData {
  scores: { playerId: string; playerName: string; score: number; roundScore: number }[];
  correctAnswer: string;
  description: string;
  gameOver: boolean;
}

const TIMER_MAP: Record<Difficulty, number> = { easy: 45, medium: 30, hard: 20 };

export function useSoloGame({ dataset, playerName, difficulty, rounds }: UseSoloGameOptions) {
  const sessionRef = useRef<GameSession | null>(null);
  const playerIdRef = useRef<string>("");
  const [round, setRound] = useState<RoundData | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [guessesLeft, setGuessesLeft] = useState(3);
  const [score, setScore] = useState(0);
  const [roundEnd, setRoundEnd] = useState<RoundEndData | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "round_end" | "game_over">("idle");
  const [previousGuesses, setPreviousGuesses] = useState<{ guess: string; correct: boolean }[]>([]);

  const hintTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const session = createGameSession(dataset, "solo", difficulty, rounds, TIMER_MAP[difficulty], playerName);
    sessionRef.current = session;
    playerIdRef.current = Array.from(session.players.keys())[0];
    return () => {
      if (hintTimerRef.current) clearInterval(hintTimerRef.current);
    };
  }, [dataset, playerName, difficulty, rounds]);

  const startRound = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    setLoading(true);
    setError(null);
    setHints([]);
    setGuessesLeft(3);
    setRoundEnd(null);
    setPreviousGuesses([]);

    if (hintTimerRef.current) clearInterval(hintTimerRef.current);

    const timerSeconds = TIMER_MAP[difficulty];
    const roundState = startNextRound(session, timerSeconds);

    if (!roundState) {
      if (isGameOver(session)) {
        setGameOver(true);
        setPhase("game_over");
      }
      setLoading(false);
      return;
    }

    setRound({
      roundNumber: roundState.roundNumber,
      imageUrl: roundState.entity.imageUrl,
      timerSeconds: roundState.timerSeconds,
      totalRounds: session.totalRounds,
    });
    setPhase("playing");
    setLoading(false);

    const interval = (timerSeconds * 1000) / 3;
    let count = 0;
    hintTimerRef.current = setInterval(() => {
      count++;
      if (count > 2) {
        if (hintTimerRef.current) clearInterval(hintTimerRef.current);
        return;
      }
      const result = revealHint(session);
      if (result) {
        setHints((prev) => [...prev, result.hint]);
      }
    }, interval);
  }, [difficulty]);

  const submitGuess = useCallback(
    (guess: string) => {
      if (!guess.trim()) return;
      const session = sessionRef.current;
      if (!session) return;

      setError(null);

      const result = processGuess(session, playerIdRef.current, guess);
      if (!result) return;

      setGuessesLeft(result.guessesLeft);
      setPreviousGuesses((prev) => [...prev, { guess, correct: result.correct }]);

      if (result.correct) {
        setScore((prev) => prev + result.score);
      }

      if (result.correct || result.guessesLeft === 0 || isRoundOver(session)) {
        if (hintTimerRef.current) clearInterval(hintTimerRef.current);
        const endData = endRound(session);
        if (endData) {
          const over = isGameOver(session);
          setRoundEnd({ ...endData, gameOver: over });
          setPhase("round_end");
          if (over) {
            setGameOver(true);
          }
        }
      }
    },
    []
  );

  const forceEndRound = useCallback(() => {
    if (hintTimerRef.current) clearInterval(hintTimerRef.current);
    const session = sessionRef.current;
    if (!session) return;

    const endData = endRound(session);
    if (endData) {
      const over = isGameOver(session);
      setRoundEnd({ ...endData, gameOver: over });
      setPhase("round_end");
      if (over) {
        setGameOver(true);
      }
    }
  }, []);

  return {
    round,
    hints,
    guessesLeft,
    score,
    roundEnd,
    gameOver,
    loading,
    error,
    phase,
    previousGuesses,
    startRound,
    submitGuess,
    forceEndRound,
  };
}
