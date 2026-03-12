"use client";

interface ProgressBarProps {
  phase: "entities" | "processing" | "ready";
  current: number;
  total: number;
  message: string;
}

export default function ProgressBar({ phase, current, total, message }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  
  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-600 font-medium">{message}</span>
        <span className="text-stone-500">{percent}%</span>
      </div>
      
      <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      
      <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
        {phase === "entities" && (
          <>
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Generating entity list...</span>
          </>
        )}
        {phase === "processing" && (
          <>
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>
              {current}/{total} entities ready (images + hints)
            </span>
          </>
        )}
        {phase === "ready" && (
          <span className="text-green-600 font-medium">Game ready! Starting...</span>
        )}
      </div>
    </div>
  );
}
