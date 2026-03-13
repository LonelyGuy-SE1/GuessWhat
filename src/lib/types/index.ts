// ─── Entity & Game Types ───

export interface Entity {
  id: string;
  name: string;
  description: string;
  category: string;
  year?: string;
  imageUrl: string;
  hints: [string, string, string]; // broad, contextual, specific
  acceptedAnswers: string[];
}

export interface GameDataset {
  topic: string;
  entities: Entity[];
  createdAt: number;
}

export interface GameSession {
  id: string;
  dataset: GameDataset;
  currentRound: number;
  totalRounds: number;
  mode: "solo" | "multiplayer";
  difficulty: Difficulty;
  players: Map<string, Player>;
  roundState: RoundState | null;
  status: "waiting" | "playing" | "finished";
  createdAt: number;
}

export interface RoundState {
  roundNumber: number;
  entity: Entity;
  startedAt: number;
  timerSeconds: number;
  revealedHints: number; // 0, 1, 2, or 3
  guesses: Map<string, PlayerRoundState>;
}

export interface PlayerRoundState {
  guessesUsed: number;
  guessedCorrectly: boolean;
  score: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

export type Difficulty = "easy" | "medium" | "hard";

// ─── Room Types ───

export interface Room {
  id: string;
  name: string;
  hostId: string;
  topic: string;
  difficulty: Difficulty;
  totalRounds: number;
  timerSeconds: number;
  maxPlayers: number;
  players: Map<string, Player>;
  sessionId: string | null;
  status: "lobby" | "generating" | "playing" | "finished";
  createdAt: number;
}

export interface RoomSettings {
  name: string;
  topic: string;
  difficulty: Difficulty;
  totalRounds: number;
  timerSeconds: number;
  maxPlayers: number;
}

// ─── WebSocket Message Types ───

export type WSClientMessage =
  | { type: "join_room"; roomId: string; playerName: string; playerId?: string }
  | { type: "start_game"; roomId: string }
  | { type: "guess"; roomId: string; guess: string }
  | { type: "next_round"; roomId: string }
  | { type: "ping" };

export type WSServerMessage =
  | { type: "room_state"; room: SerializedRoom }
  | { type: "game_started"; sessionId: string }
  | { type: "round_start"; round: SerializedRoundState; roundNumber: number; totalRounds: number }
  | { type: "hint_revealed"; hintIndex: number; hint: string }
  | { type: "guess_result"; playerId: string; playerName: string; guess: string; correct: boolean; guessesLeft: number }
  | { type: "round_end"; scores: PlayerScore[]; correctAnswer: string; description: string }
  | { type: "game_end"; finalScores: PlayerScore[] }
  | { type: "player_joined"; player: SerializedPlayer }
  | { type: "player_left"; playerId: string }
  | { type: "error"; message: string }
  | { type: "pong" };

export interface PlayerScore {
  playerId: string;
  playerName: string;
  score: number;
  roundScore: number;
}

// ─── Serialized types (for JSON transport, no Maps) ───

export interface SerializedRoom {
  id: string;
  name: string;
  hostId: string;
  topic: string;
  difficulty: Difficulty;
  totalRounds: number;
  timerSeconds: number;
  maxPlayers: number;
  players: SerializedPlayer[];
  sessionId: string | null;
  status: "lobby" | "generating" | "playing" | "finished";
  createdAt: number;
}

export interface SerializedPlayer {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

export interface SerializedRoundState {
  roundNumber: number;
  imageUrl: string;
  startedAt: number;
  timerSeconds: number;
  revealedHints: number;
  hints: string[]; // only the revealed ones
}

// ─── AI Types ───

export type ModelTask = "orchestrate" | "generate_entities" | "generate_hints" | "validate_image" | "generate_image";

export interface ModelChoice {
  model: string;
  task: ModelTask;
  reason: string;
}

export interface CommonStackMessage {
  role: "system" | "user" | "assistant";
  content: string | CommonStackContentPart[];
}

export interface CommonStackContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface CommonStackResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}
