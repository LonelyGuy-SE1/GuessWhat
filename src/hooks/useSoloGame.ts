"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseSoloGameOptions {
  sessionId: string;
  playerId: string;
}

interface RoundData {
  roundNumber: number;
  imageUrl: string;
  timerSeconds: number;
  totalRounds: number;
}

interface HintData {
  hintIndex: number;
  hint: string;
}

interface GuessResult {
  correct: boolean;
  guessesLeft: number;
  score: number;
  roundOver: boolean;
}

interface RoundEndData {
  scores: { playerId: string; playerName: string; score: number; roundScore: number }[];
  correctAnswer: string;
  description: string;
  gameOver: boolean;
}

export function useSoloGame({ sessionId, playerId }: UseSoloGameOptions) {
  const [round, setRound] = useState<RoundData | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [guessesLeft, setGuessesLeft] = useState(3);
  const [score, setScore] = useState(0);
  const [roundEnd, setRoundEnd] = useState<RoundEndData | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [finalScores, setFinalScores] = useState<RoundEndData["scores"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "round_end" | "game_over">("idle");

  // Hint auto-reveal timer
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);

  const apiCall = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      const res = await fetch(`/api/game/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, playerId, ...extra }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "API request failed");
      }
      return res.json();
    },
    [sessionId, playerId]
  );

  const startRound = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHints([]);
    setGuessesLeft(3);
    setRoundEnd(null);

    try {
      const data = await apiCall("start_round");
      if (data.action === "game_over") {
        setGameOver(true);
        setFinalScores(data.finalScores);
        setPhase("game_over");
      } else {
        setRound({
          roundNumber: data.roundNumber,
          imageUrl: data.imageUrl,
          timerSeconds: data.timerSeconds,
          totalRounds: data.totalRounds,
        });
        setPhase("playing");

        // Schedule hint reveals
        const interval = (data.timerSeconds * 1000) / 3;
        let count = 0;
        hintTimerRef.current = setInterval(async () => {
          count++;
          if (count > 2) {
            if (hintTimerRef.current) clearInterval(hintTimerRef.current);
            return;
          }
          try {
            const hintData: HintData = await apiCall("reveal_hint");
            setHints((prev) => [...prev, hintData.hint]);
          } catch {
            // ignore
          }
        }, interval);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start round");
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  const submitGuess = useCallback(
    async (guess: string) => {
      if (!guess.trim()) return;
      setError(null);

      try {
        const result: GuessResult = await apiCall("guess", { guess });
        setGuessesLeft(result.guessesLeft);

        if (result.correct) {
          setScore((prev) => prev + result.score);
        }

        if (result.roundOver || result.correct || result.guessesLeft === 0) {
          if (hintTimerRef.current) clearInterval(hintTimerRef.current);
          const endData: RoundEndData = await apiCall("end_round");
          setRoundEnd(endData);
          setPhase("round_end");

          if (endData.gameOver) {
            setGameOver(true);
            setFinalScores(endData.scores);
          }
        }

        return result;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to submit guess");
        return null;
      }
    },
    [apiCall]
  );

  const forceEndRound = useCallback(async () => {
    if (hintTimerRef.current) clearInterval(hintTimerRef.current);
    try {
      const endData: RoundEndData = await apiCall("end_round");
      setRoundEnd(endData);
      setPhase("round_end");
      if (endData.gameOver) {
        setGameOver(true);
        setFinalScores(endData.scores);
      }
    } catch {
      // ignore
    }
  }, [apiCall]);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearInterval(hintTimerRef.current);
    };
  }, []);

  return {
    round,
    hints,
    guessesLeft,
    score,
    roundEnd,
    gameOver,
    finalScores,
    loading,
    error,
    phase,
    startRound,
    submitGuess,
    forceEndRound,
  };
}
