"use client";

import ImageViewer from "./ImageViewer";
import GuessInput from "./GuessInput";
import HintPanel from "./HintPanel";
import Timer from "./Timer";
import Leaderboard from "./Leaderboard";

interface GameScreenProps {
  mode: "solo" | "multiplayer";
  imageUrl: string;
  roundNumber: number;
  totalRounds: number;
  timerSeconds: number;
  startedAt: number;
  hints: string[];
  guessesLeft: number;
  score: number;
  scores: {
    playerId: string;
    playerName: string;
    score: number;
    roundScore: number;
  }[];
  currentPlayerId: string;
  onGuess: (guess: string) => void;
  onTimerExpire: () => void;
  roundResult: {
    correctAnswer: string;
    description: string;
    scores: {
      playerId: string;
      playerName: string;
      score: number;
      roundScore: number;
    }[];
  } | null;
  onNextRound: () => void;
  gameOver: boolean;
  disabled?: boolean;
  previousGuesses?: { guess: string; correct: boolean }[];
}

export default function GameScreen({
  imageUrl,
  roundNumber,
  totalRounds,
  timerSeconds,
  startedAt,
  hints,
  guessesLeft,
  scores,
  currentPlayerId,
  onGuess,
  onTimerExpire,
  roundResult,
  onNextRound,
  gameOver,
  disabled,
  previousGuesses = [],
}: GameScreenProps) {
  return (
    <div className="space-y-6">
      {/* Round header */}
      <div className="flex items-center justify-between bg-stone-50 px-4 py-3 rounded-xl border border-stone-200">
        <span className="text-sm text-stone-500">
          Round{" "}
          <span className="font-bold text-stone-800 text-lg">
            {roundNumber}
          </span>{" "}
          / {totalRounds}
        </span>
        <div className="w-40">
          <Timer
            durationSeconds={timerSeconds}
            startedAt={startedAt}
            onExpire={onTimerExpire}
            paused={!!roundResult}
          />
        </div>
      </div>

      {roundResult ? (
        /* Round End Screen */
        <div className="space-y-6">
          <div className="text-center space-y-3 py-6 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50">
            <p className="text-sm text-stone-500">The answer was</p>
            <h2 className="text-3xl font-bold text-stone-800">
              {roundResult.correctAnswer}
            </h2>
            <p className="text-sm text-stone-600 max-w-md mx-auto px-4">
              {roundResult.description}
            </p>
          </div>

          <Leaderboard
            scores={roundResult.scores}
            currentPlayerId={currentPlayerId}
            showRoundScore
          />

          {!gameOver && (
            <button
              onClick={onNextRound}
              className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
            >
              Next Round
            </button>
          )}

          {gameOver && (
            <div className="text-center space-y-4 py-6">
              <h2 className="text-2xl font-bold text-stone-800">Game Over!</h2>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
              >
                Play Again
              </a>
            </div>
          )}
        </div>
      ) : (
        /* Active Round */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <ImageViewer src={imageUrl} />
            <GuessInput
              onSubmit={onGuess}
              guessesLeft={guessesLeft}
              disabled={disabled}
              previousGuesses={previousGuesses}
            />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <HintPanel hints={hints} />
            <Leaderboard scores={scores} currentPlayerId={currentPlayerId} />
          </div>
        </div>
      )}
    </div>
  );
}
