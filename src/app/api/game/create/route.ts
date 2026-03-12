import { NextRequest } from "next/server";
import { generateGameDataset, type GenerationProgress } from "@/lib/ai/orchestrator";
import { createGameSession } from "@/lib/game/engine";
import type { Difficulty } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { apiKey, topic, difficulty, rounds, playerName } = body as {
    apiKey: string;
    topic: string;
    difficulty: Difficulty;
    rounds: number;
    playerName: string;
  };

  if (!apiKey || !topic || !playerName) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validDifficulty: Difficulty = ["easy", "medium", "hard"].includes(difficulty)
    ? difficulty
    : "medium";
  const validRounds = Math.min(Math.max(rounds || 5, 1), 20);
  const timerMap: Record<Difficulty, number> = { easy: 45, medium: 30, hard: 20 };

  // Use Server-Sent Events for progress streaming
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const dataset = await generateGameDataset(
          apiKey,
          topic,
          validDifficulty,
          validRounds,
          (progress: GenerationProgress) => {
            send({ type: "progress", ...progress });
          }
        );

        const session = createGameSession(
          dataset,
          "solo",
          validDifficulty,
          validRounds,
          timerMap[validDifficulty],
          playerName
        );

        const playerId = Array.from(session.players.keys())[0];

        send({
          type: "complete",
          sessionId: session.id,
          playerId,
          totalRounds: session.totalRounds,
          topic: dataset.topic,
          entityCount: dataset.entities.length,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to generate game";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
