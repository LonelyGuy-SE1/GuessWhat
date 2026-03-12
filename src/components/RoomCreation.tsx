"use client";

import type { Difficulty, RoomSettings } from "@/lib/types";
import { useState } from "react";
import ApiKeyInput from "./ApiKeyInput";
import PromptInput from "./PromptInput";

interface RoomCreationProps {
  onCreateRoom: (
    settings: RoomSettings,
    apiKey: string,
    hostName: string,
  ) => void;
  loading?: boolean;
}

export default function RoomCreation({
  onCreateRoom,
  loading,
}: RoomCreationProps) {
  const [apiKey, setApiKey] = useState("");
  const [hostName, setHostName] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [rounds, setRounds] = useState(10);
  const [timer, setTimer] = useState(30);
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [roomName, setRoomName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !topic || !hostName) return;
    onCreateRoom(
      {
        name: roomName || `${hostName}'s Room`,
        topic,
        difficulty,
        totalRounds: rounds,
        timerSeconds: timer,
        maxPlayers,
      },
      apiKey,
      hostName,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-stone-600">
          Your Name
        </label>
        <input
          type="text"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none transition-colors"
          required
        />
      </div>

      <ApiKeyInput value={apiKey} onChange={setApiKey} />
      <PromptInput value={topic} onChange={setTopic} />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-stone-600">
          Room Name (optional)
        </label>
        <input
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="My Awesome Room"
          className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-600">
            Difficulty
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 focus:border-amber-400 focus:outline-none transition-colors"
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
            onChange={(e) => setRounds(parseInt(e.target.value) || 10)}
            min={1}
            max={50}
            className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 focus:border-amber-400 focus:outline-none transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-600">
            Timer (seconds)
          </label>
          <input
            type="number"
            value={timer}
            onChange={(e) => setTimer(parseInt(e.target.value) || 30)}
            min={10}
            max={120}
            className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 focus:border-amber-400 focus:outline-none transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-600">
            Max Players
          </label>
          <input
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 20)}
            min={2}
            max={100}
            className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 focus:border-amber-400 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !apiKey || !topic || !hostName}
        className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating Room..." : "Create Room"}
      </button>
    </form>
  );
}
