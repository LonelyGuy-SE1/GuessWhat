"use client";

import { useState, useRef, useEffect } from "react";
import type { Difficulty, GameDataset } from "@/lib/types";
import { generateGameDataset, type GenerationProgress } from "@/lib/ai/orchestrator";
import ApiKeyInput from "@/components/ApiKeyInput";
import PromptInput from "@/components/PromptInput";
import ProgressBar from "@/components/ProgressBar";
import GameScreen from "@/components/GameScreen";
import { useSoloGame } from "@/hooks/useSoloGame";

type Phase = "setup" | "generating" | "playing";

interface Progress {
  phase: "entities" | "processing" | "ready";
  current: number;
  total: number;
  message: string;
}

export default function SoloPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [apiKey, setApiKey] = useState("");
  const [topic, setTopic] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [rounds, setRounds] = useState<number | "">(5);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<GameDataset | null>(null);
  const [progress, setProgress] = useState<Progress>({
    phase: "entities",
    current: 0,
    total: 0,
    message: "Starting...",
  });
  const abortedRef = useRef(false);

  useEffect(() => {
    return () => {
      abortedRef.current = true;
    };
  }, []);

  async function handleStartGame(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !topic || !playerName) return;

    setPhase("generating");
    setError(null);
    abortedRef.current = false;
    setProgress({
      phase: "entities",
      current: 0,
      total: rounds || 5,
      message: "Starting...",
    });

    try {
      const result = await generateGameDataset(
        apiKey,
        topic,
        difficulty,
        rounds || 5,
        (p: GenerationProgress) => {
          if (abortedRef.current) return;
          setProgress({
            phase: p.phase,
            current: p.entitiesReady,
            total: p.entitiesTotal || rounds || 5,
            message: p.message,
          });
        }
      );

      if (abortedRef.current) return;
      setDataset(result);
      setPhase("playing");
    } catch (err: unknown) {
      if (abortedRef.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("setup");
    }
  }

  if (phase === "setup" || phase === "generating") {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-stone-800">Solo Mode</h1>
          <p className="text-sm text-stone-500">
            Pick a topic and challenge yourself
          </p>
        </div>

        <form onSubmit={handleStartGame} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-600">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none transition-colors"
              required
              disabled={phase === "generating"}
            />
          </div>

          <ApiKeyInput value={apiKey} onChange={setApiKey} />
          <PromptInput value={topic} onChange={setTopic} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-stone-600">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                disabled={phase === "generating"}
                className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 focus:border-amber-400 focus:outline-none transition-colors disabled:opacity-50"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-stone-600">
                Rounds
              </label>
              <input
                type="number"
                value={rounds}
                onChange={(e) => setRounds(e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                min={1}
                max={20}
                disabled={phase === "generating"}
                className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 focus:border-amber-400 focus:outline-none transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 border-2 border-dashed border-red-300 rounded-xl bg-red-50 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              phase === "generating" || !apiKey || !topic || !playerName
            }
            className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {phase === "generating" ? "Generating..." : "Start Game"}
          </button>

          {phase === "generating" && (
            <div className="border-2 border-dashed border-stone-300 rounded-xl p-4 bg-stone-50">
              <ProgressBar
                phase={progress.phase}
                current={progress.current}
                total={progress.total}
                message={progress.message}
              />
              <p className="mt-3 text-xs text-stone-500">
                Generation takes at least 30 seconds. Please keep this tab open.
              </p>
            </div>
          )}
        </form>
      </div>
    );
  }

  if (!dataset) return null;

  return (
    <SoloGamePlay
      dataset={dataset}
      playerName={playerName}
      difficulty={difficulty}
      rounds={rounds || 5}
    />
  );
}

function SoloGamePlay({
  dataset,
  playerName,
  difficulty,
  rounds,
}: {
  dataset: GameDataset;
  playerName: string;
  difficulty: Difficulty;
  rounds: number;
}) {
  const {
    round,
    hints,
    guessesLeft,
    score,
    roundEnd,
    gameOver,
    loading,
    error,
    previousGuesses,
    playerId,
    startRound,
    submitGuess,
    forceEndRound,
  } = useSoloGame({ dataset, playerName, difficulty, rounds });

  if (loading && !round) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500">Loading round...</p>
      </div>
    );
  }

  if (error && !round) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 py-20">
        <p className="text-red-500">{error}</p>
        <a
          href="/solo"
          className="inline-block px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
        >
          Try Again
        </a>
      </div>
    );
  }

  if (!round) return null;

  const scores = [
    {
      playerId,
      playerName,
      score,
      roundScore:
        roundEnd?.scores.find((s) => s.playerName === playerName)?.roundScore ?? 0,
    },
  ];

  return (
    <GameScreen
      mode="solo"
      imageUrl={round.imageUrl}
      roundNumber={round.roundNumber}
      totalRounds={round.totalRounds}
      timerSeconds={round.timerSeconds}
      startedAt={Date.now()}
      hints={hints}
      guessesLeft={guessesLeft}
      score={score}
      scores={roundEnd?.scores ?? scores}
      currentPlayerId={playerId}
      onGuess={submitGuess}
      onTimerExpire={forceEndRound}
      roundResult={roundEnd}
      onNextRound={startRound}
      gameOver={gameOver}
      previousGuesses={previousGuesses}
    />
  );
}

