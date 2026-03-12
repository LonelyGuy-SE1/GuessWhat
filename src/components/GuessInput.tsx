"use client";

import { useState, useRef, useEffect } from "react";

interface GuessInputProps {
  onSubmit: (guess: string) => void;
  guessesLeft: number;
  disabled?: boolean;
  previousGuesses?: { guess: string; correct: boolean }[];
}

export default function GuessInput({
  onSubmit,
  guessesLeft,
  disabled,
  previousGuesses = [],
}: GuessInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [guessesLeft]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled || guessesLeft <= 0) return;
    onSubmit(value.trim());
    setValue("");
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              guessesLeft > 0 ? "Type your guess..." : "No guesses left"
            }
            disabled={disabled || guessesLeft <= 0}
            className="flex-1 px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || guessesLeft <= 0 || !value.trim()}
            className="px-6 py-2.5 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guess
          </button>
        </div>
        <p className="text-xs text-stone-400">
          {guessesLeft > 0
            ? `${guessesLeft} guess${guessesLeft !== 1 ? "es" : ""} remaining`
            : "No guesses remaining"}
        </p>
      </form>

      {previousGuesses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previousGuesses.map((g, i) => (
            <span
              key={i}
              className={`px-3 py-1 rounded-lg text-sm ${
                g.correct
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-red-50 text-red-600 border border-red-200 line-through"
              }`}
            >
              {g.guess}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
