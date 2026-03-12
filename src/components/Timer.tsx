"use client";

import { useState, useEffect, useRef } from "react";

interface TimerProps {
  durationSeconds: number;
  startedAt: number;
  onExpire?: () => void;
  paused?: boolean;
}

export default function Timer({
  durationSeconds,
  startedAt,
  onExpire,
  paused,
}: TimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    if (paused) return;

    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, durationSeconds - elapsed);
      setRemaining(left);

      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [durationSeconds, startedAt, onExpire, paused]);

  const pct = (remaining / durationSeconds) * 100;
  const seconds = Math.ceil(remaining);
  const isLow = seconds <= 10;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-500">Time</span>
        <span
          className={`text-lg font-bold tabular-nums ${
            isLow ? "text-red-500 animate-pulse" : "text-stone-700"
          }`}
        >
          {seconds}s
        </span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-100 ${
            isLow ? "bg-red-400" : pct > 50 ? "bg-amber-400" : "bg-amber-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
