"use client";

interface GuessEntry {
  playerId: string;
  playerName: string;
  guess: string;
  correct: boolean;
}

interface GuessFeedProps {
  guesses: GuessEntry[];
  currentPlayerId: string;
}

export default function GuessFeed({ guesses, currentPlayerId }: GuessFeedProps) {
  // Find players who guessed correctly — hide ALL their guesses from other players
  const correctPlayerIds = new Set(
    guesses.filter((g) => g.correct).map((g) => g.playerId)
  );

  // Filter guesses: show your own guesses, but hide other players' guesses
  // once they got the correct answer (to prevent revealing the answer)
  const visibleGuesses = guesses.filter((g) => {
    if (g.playerId === currentPlayerId) {
      // Always show your own guesses (you already know if you got it right)
      return true;
    }
    // For other players: hide all their guesses once they got it right
    if (correctPlayerIds.has(g.playerId)) {
      return false;
    }
    // Show incorrect guesses from other players
    return true;
  });

  if (visibleGuesses.length === 0) {
    return (
      <div className="border-2 border-dashed border-stone-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-stone-500 mb-2">Live Guesses</h3>
        <p className="text-xs text-stone-400 italic">No guesses yet...</p>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-stone-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-stone-500 mb-3">Live Guesses</h3>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {visibleGuesses.map((g, i) => {
          const isYou = g.playerId === currentPlayerId;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                g.correct
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-stone-50 border border-stone-150"
              }`}
            >
              <span
                className={`font-semibold shrink-0 ${
                  isYou ? "text-amber-600" : "text-stone-600"
                }`}
              >
                {isYou ? "You" : g.playerName}
              </span>
              <span className="text-stone-400">→</span>
              <span
                className={`truncate ${
                  g.correct ? "text-emerald-700 font-medium" : "text-stone-500 line-through"
                }`}
              >
                {g.correct ? "Got it!" : g.guess}
              </span>
              {g.correct && (
                <span className="text-emerald-500 ml-auto shrink-0">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
