"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "commonstack_api_key";

interface ApiKeyInputProps {
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

export default function ApiKeyInput({
  value,
  onChange,
  disabled,
}: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !value) {
      onChange(saved);
    }
    setLoaded(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (loaded && value) {
      localStorage.setItem(STORAGE_KEY, value);
    }
  }, [value, loaded]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-600">
        Commonstack API Key
      </label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-..."
          disabled={disabled}
          className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none transition-colors disabled:opacity-50"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
        >
          {visible ? "hide" : "show"}
        </button>
      </div>
      <p className="text-xs text-stone-400">
        Saved in browser.{" "}
        <a
          href="https://www.commonstack.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 hover:text-amber-700 underline"
        >
          Get an API key
        </a>
      </p>
    </div>
  );
}
