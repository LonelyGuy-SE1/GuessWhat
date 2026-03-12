"use client";

import type { SerializedRoom } from "@/lib/types";

interface LobbyProps {
  room: SerializedRoom;
  currentPlayerId: string;
  onStart: () => void;
  starting?: boolean;
  wsConnected?: boolean;
}

export default function Lobby({
  room,
  currentPlayerId,
  onStart,
  starting,
  wsConnected,
}: LobbyProps) {
  const isHost = room.hostId === currentPlayerId;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-stone-800">{room.name}</h2>
        <div className="inline-block px-4 py-1.5 bg-stone-100 rounded-full">
          <span className="text-sm text-stone-500">Room Code: </span>
          <span className="text-lg font-bold text-amber-600 tracking-widest">
            {room.id}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl">
          <span className="text-stone-400 block text-xs">Topic</span>
          <span className="text-stone-700 font-medium">{room.topic}</span>
        </div>
        <div className="px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl">
          <span className="text-stone-400 block text-xs">Difficulty</span>
          <span className="text-stone-700 font-medium capitalize">
            {room.difficulty}
          </span>
        </div>
        <div className="px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl">
          <span className="text-stone-400 block text-xs">Rounds</span>
          <span className="text-stone-700 font-medium">{room.totalRounds}</span>
        </div>
        <div className="px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl">
          <span className="text-stone-400 block text-xs">Timer</span>
          <span className="text-stone-700 font-medium">
            {room.timerSeconds}s
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-stone-600">
          Players ({room.players.length}/{room.maxPlayers})
        </h3>
        <div className="border-2 border-dashed border-stone-200 rounded-xl p-3 space-y-1.5">
          {room.players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                p.id === currentPlayerId ? "bg-amber-50" : ""
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  p.connected ? "bg-green-400" : "bg-stone-300"
                }`}
              />
              <span className="text-sm text-stone-700">
                {p.name}
                {p.id === room.hostId && (
                  <span className="text-xs text-amber-500 ml-1">(host)</span>
                )}
                {p.id === currentPlayerId && (
                  <span className="text-xs text-stone-400 ml-1">(you)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          disabled={starting || room.players.length < 1 || !wsConnected}
          className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!wsConnected ? "Connecting..." : starting ? "Generating Game..." : "Start Game"}
        </button>
      ) : (
        <div className="text-center py-3 text-stone-400 text-sm">
          Waiting for the host to start the game...
        </div>
      )}

      {room.status === "generating" && (
        <div className="text-center py-4 space-y-2">
          <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-stone-500">
            Generating game content with AI...
          </p>
          <p className="text-xs text-stone-400">
            This takes at least 30 seconds. Keep this tab open.
          </p>
        </div>
      )}
    </div>
  );
}
