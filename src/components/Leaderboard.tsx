"use client";

interface PlayerScore {
  playerId: string;
  playerName: string;
  score: number;
  roundScore: number;
}

interface LeaderboardProps {
  scores: PlayerScore[];
  currentPlayerId?: string;
  showRoundScore?: boolean;
}

export default function Leaderboard({
  scores,
  currentPlayerId,
  showRoundScore,
}: LeaderboardProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-stone-600">Leaderboard</h3>
      <div className="border-2 border-dashed border-stone-200 rounded-xl overflow-hidden">
        {scores.length === 0 ? (
          <div className="p-4 text-center text-stone-400 text-sm">
            No scores yet
          </div>
        ) : (
          <ul className="divide-y divide-dashed divide-stone-200">
            {scores.map((entry, i) => (
              <li
                key={entry.playerId}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  entry.playerId === currentPlayerId ? "bg-amber-50" : ""
                }`}
              >
                <span
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                    i === 0
                      ? "bg-amber-400 text-white"
                      : i === 1
                        ? "bg-stone-300 text-white"
                        : i === 2
                          ? "bg-amber-700 text-white"
                          : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-stone-700 font-medium truncate">
                  {entry.playerName}
                  {entry.playerId === currentPlayerId && (
                    <span className="text-xs text-amber-500 ml-1">(you)</span>
                  )}
                </span>
                <div className="text-right">
                  <span className="text-sm font-bold text-stone-800">
                    {entry.score}
                  </span>
                  {showRoundScore && entry.roundScore > 0 && (
                    <span className="text-xs text-green-600 ml-1">
                      +{entry.roundScore}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
