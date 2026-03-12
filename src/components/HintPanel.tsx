"use client";

interface HintPanelProps {
  hints: string[];
  maxHints?: number;
}

export default function HintPanel({ hints, maxHints = 3 }: HintPanelProps) {
  const labels = ["Broad Clue", "Contextual Clue", "Specific Clue"];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-stone-600">Hints</h3>
      <div className="space-y-2">
        {Array.from({ length: maxHints }).map((_, i) => (
          <div
            key={i}
            className={`px-4 py-3 rounded-xl border-2 border-dashed transition-all duration-500 ${
              i < hints.length
                ? "border-amber-300 bg-amber-50 text-stone-700"
                : "border-stone-200 bg-stone-50 text-stone-300"
            }`}
          >
            <span className="text-xs font-medium block mb-0.5">
              {labels[i]}
            </span>
            {i < hints.length ? (
              <p className="text-sm">{hints[i]}</p>
            ) : (
              <p className="text-sm italic">
                {i === hints.length ? "Revealing soon..." : "Locked"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
