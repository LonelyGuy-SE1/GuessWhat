"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomSettings, SerializedRoom } from "@/lib/types";
import RoomCreation from "@/components/RoomCreation";

type View = "menu" | "create" | "join";

export default function MultiplayerPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("menu");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  async function handleCreateRoom(
    settings: RoomSettings,
    apiKey: string,
    hostName: string
  ) {
    setCreateLoading(true);
    setJoinError(null);

    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, hostName, apiKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create room");
      }

      const data: { room: SerializedRoom; playerId: string } = await res.json();

      sessionStorage.setItem(
        `room_${data.room.id}`,
        JSON.stringify({
          playerId: data.playerId,
          playerName: hostName,
          isHost: true,
        })
      );

      router.push(`/multiplayer/${data.room.id}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Failed to create room");
      setCreateLoading(false);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode.trim() || !playerName.trim()) return;

    setJoinLoading(true);
    setJoinError(null);

    try {
      const roomId = roomCode.trim().toUpperCase();
      const res = await fetch(`/api/room/${roomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", playerName: playerName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join room");
      }

      const data: { playerId: string; room: SerializedRoom } = await res.json();

      sessionStorage.setItem(
        `room_${data.room.id}`,
        JSON.stringify({
          playerId: data.playerId,
          playerName: playerName.trim(),
          isHost: false,
        })
      );

      router.push(`/multiplayer/${data.room.id}`);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Failed to join room");
      setJoinLoading(false);
    }
  }

  if (view === "menu") {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-stone-800">Multiplayer</h1>
          <p className="text-sm text-stone-500">Play with friends in real-time</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setView("create")}
            className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-stone-300 rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 transition-all"
          >
            <span className="text-2xl">+</span>
            <span className="text-lg font-bold text-stone-800">Create Room</span>
            <span className="text-xs text-stone-400">Set up a new game room</span>
          </button>

          <button
            onClick={() => setView("join")}
            className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-stone-300 rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 transition-all"
          >
            <span className="text-2xl">&rarr;</span>
            <span className="text-lg font-bold text-stone-800">Join Room</span>
            <span className="text-xs text-stone-400">Enter a room code to join</span>
          </button>
        </div>
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView("menu")}
            className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold text-stone-800">Create Room</h1>
        </div>

        {joinError && (
          <div className="px-4 py-3 border-2 border-dashed border-red-300 rounded-xl bg-red-50 text-sm text-red-600">
            {joinError}
          </div>
        )}

        <RoomCreation onCreateRoom={handleCreateRoom} loading={createLoading} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setView("menu")}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold text-stone-800">Join Room</h1>
      </div>

      <form onSubmit={handleJoinRoom} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-600">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none transition-colors"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-600">Room Code</label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            maxLength={6}
            className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none transition-colors"
            required
          />
        </div>

        {joinError && (
          <div className="px-4 py-3 border-2 border-dashed border-red-300 rounded-xl bg-red-50 text-sm text-red-600">
            {joinError}
          </div>
        )}

        <button
          type="submit"
          disabled={joinLoading}
          className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {joinLoading ? "Joining..." : "Join Room"}
        </button>
      </form>
    </div>
  );
}
