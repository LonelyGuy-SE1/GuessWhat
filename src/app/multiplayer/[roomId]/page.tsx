"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import type {
  SerializedRoom,
  SerializedRoundState,
  WSServerMessage,
  PlayerScore,
} from "@/lib/types";
import Lobby from "@/components/Lobby";
import GameScreen from "@/components/GameScreen";
import Leaderboard from "@/components/Leaderboard";

type RoomPhase =
  | "connecting"
  | "lobby"
  | "generating"
  | "playing"
  | "round_end"
  | "game_over";

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [phase, setPhase] = useState<RoomPhase>("connecting");
  const [room, setRoom] = useState<SerializedRoom | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [connected, setConnected] = useState(false);

  // Game state
  const [roundData, setRoundData] = useState<SerializedRoundState | null>(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const [guessesLeft, setGuessesLeft] = useState(3);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [roundResult, setRoundResult] = useState<{
    correctAnswer: string;
    description: string;
    scores: PlayerScore[];
  } | null>(null);
  const [finalScores, setFinalScores] = useState<PlayerScore[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef(Date.now());

  const handleEvent = useCallback(
    (msg: WSServerMessage) => {
      switch (msg.type) {
        case "room_state":
          setRoom(msg.room);
          if (msg.room.status === "lobby") setPhase("lobby");
          else if (msg.room.status === "generating") setPhase("generating");
          else if (msg.room.status === "playing") setPhase("playing");
          break;

        case "player_joined":
          setRoom((prev) => {
            if (!prev) return prev;
            const exists = prev.players.some((p) => p.id === msg.player.id);
            return {
              ...prev,
              players: exists ? prev.players : [...prev.players, msg.player],
            };
          });
          break;

        case "player_left":
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.filter((p) => p.id !== msg.playerId),
            };
          });
          break;

        case "game_started":
          setPhase("playing");
          break;

        case "round_start":
          setRoundData(msg.round);
          setRoundNumber(msg.roundNumber);
          setTotalRounds(msg.totalRounds);
          setHints(msg.round.hints || []);
          setGuessesLeft(3);
          setRoundResult(null);
          startedAtRef.current = msg.round.startedAt;
          setPhase("playing");
          break;

        case "hint_revealed":
          setHints((prev) => {
            const next = [...prev];
            next[msg.hintIndex] = msg.hint;
            return next;
          });
          break;

        case "guess_result":
          if (msg.playerId === playerId) {
            setGuessesLeft(msg.guessesLeft);
          }
          break;

        case "round_end":
          setRoundResult({
            correctAnswer: msg.correctAnswer,
            description: msg.description,
            scores: msg.scores,
          });
          setScores(msg.scores);
          setPhase("round_end");
          break;

        case "game_end":
          setFinalScores(msg.finalScores);
          setScores(msg.finalScores);
          setPhase("game_over");
          break;

        case "error":
          setError(msg.message);
          if (phase === "generating") setPhase("lobby");
          break;

        case "pong":
          break;
      }
    },
    [playerId, phase]
  );

  // Load session data
  useEffect(() => {
    const stored = sessionStorage.getItem(`room_${roomId}`);
    if (!stored) {
      setError("No session data found. Please join from the multiplayer page.");
      return;
    }

    const data = JSON.parse(stored);
    setPlayerName(data.playerName);
    setIsHost(data.isHost);
    if (data.playerId) setPlayerId(data.playerId);
  }, [roomId]);

  // Join or re-join room to mark connected
  useEffect(() => {
    if (!playerName) return;
    async function join() {
      try {
        const res = await fetch(`/api/room/${roomId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "join",
            playerName,
            playerId,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!playerId) setPlayerId(data.playerId);
      } catch {
        // ignore
      }
    }
    join();
  }, [roomId, playerName, playerId]);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`/api/room/${roomId}/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (event) => {
      try {
        const msg: WSServerMessage = JSON.parse(event.data);
        handleEvent(msg);
      } catch {
        // ignore
      }
    };
    return () => es.close();
  }, [roomId, handleEvent]);

  function postAction(action: string, payload?: Record<string, unknown>) {
    return fetch(`/api/room/${roomId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, playerId, ...payload }),
    });
  }

  function handleStartGame() {
    postAction("start_game");
  }

  function handleGuess(guess: string) {
    postAction("guess", { guess });
  }

  function handleNextRound() {
    postAction("next_round");
  }

  if (error && phase === "connecting") {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 py-20">
        <p className="text-red-500">{error}</p>
        <a
          href="/multiplayer"
          className="inline-block px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
        >
          Back to Multiplayer
        </a>
      </div>
    );
  }

  if (phase === "connecting" && !room) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500">Starting room {roomId}...</p>
      </div>
    );
  }

  if ((phase === "lobby" || phase === "generating" || phase === "connecting") && room) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        {error && (
          <div className="px-4 py-3 border-2 border-dashed border-red-300 rounded-xl bg-red-50 text-sm text-red-600">
            {error}
          </div>
        )}
        {!connected && (
          <div className="px-4 py-3 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50 text-sm text-amber-700">
            Multiplayer link unstable. Keep this tab open.
          </div>
        )}
        <Lobby
          room={{
            ...room,
            status: phase === "generating" ? "generating" : room.status,
          }}
          currentPlayerId={playerId || ""}
          onStart={handleStartGame}
          starting={phase === "generating"}
          wsConnected={connected}
        />
      </div>
    );
  }

  if (phase === "game_over" && finalScores) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-10">
        <h1 className="text-3xl font-bold text-stone-800">Game Over!</h1>
        <Leaderboard scores={finalScores} currentPlayerId={playerId || ""} />
        <a
          href="/multiplayer"
          className="inline-block px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
        >
          Play Again
        </a>
      </div>
    );
  }

  if ((phase === "playing" || phase === "round_end") && roundData) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="px-4 py-3 border-2 border-dashed border-red-300 rounded-xl bg-red-50 text-sm text-red-600">
            {error}
          </div>
        )}
        <GameScreen
          mode="multiplayer"
          imageUrl={roundData.imageUrl}
          roundNumber={roundNumber}
          totalRounds={totalRounds}
          timerSeconds={roundData.timerSeconds}
          startedAt={startedAtRef.current}
          hints={hints}
          guessesLeft={guessesLeft}
          score={scores.find((s) => s.playerId === playerId)?.score ?? 0}
          scores={scores}
          currentPlayerId={playerId || ""}
          onGuess={handleGuess}
          onTimerExpire={() => {}}
          roundResult={roundResult}
          onNextRound={handleNextRound}
          gameOver={false}
          disabled={!connected}
        />
        {phase === "round_end" && !isHost && (
          <p className="text-center text-sm text-stone-400">
            Waiting for host to start next round...
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-stone-500">Loading...</p>
    </div>
  );
}
