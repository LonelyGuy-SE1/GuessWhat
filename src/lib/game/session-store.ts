import type { GameSession, GameDataset } from "@/lib/types";

/**
 * In-memory session store.
 * Stored on Node.js global so it survives Next.js hot-reloads in dev.
 */
const g = global as typeof globalThis & {
  __guesswhat_sessions?: Map<string, GameSession>;
};
if (!g.__guesswhat_sessions) {
  g.__guesswhat_sessions = new Map<string, GameSession>();
}
const sessions = g.__guesswhat_sessions;

// Auto-cleanup: remove sessions older than 2 hours
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export function getSession(id: string): GameSession | undefined {
  const session = sessions.get(id);
  if (session && Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function setSession(session: GameSession): void {
  sessions.set(session.id, session);
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}

export function getAllSessions(): GameSession[] {
  return Array.from(sessions.values());
}

export function getSessionByDataset(dataset: GameDataset): GameSession | undefined {
  return Array.from(sessions.values()).find((s) => s.dataset === dataset);
}

// Periodic cleanup every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(id);
      }
    }
  }, 10 * 60 * 1000);
}
