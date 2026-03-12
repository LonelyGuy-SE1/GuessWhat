import type { Entity, Difficulty } from "@/lib/types";
import { getModelName } from "./model-router";
import { chatCompletion } from "./api-client";

interface RawEntity {
  name: string;
  description: string;
  category: string;
  year?: string;
}

export async function generateEntities(
  apiKey: string,
  topic: string,
  count: number,
  difficulty: Difficulty
): Promise<RawEntity[]> {
  const model = getModelName("generate_entities");

  const difficultyGuidance: Record<Difficulty, string> = {
    easy: "Choose well-known, popular entities that most people would recognize.",
    medium: "Mix well-known entities with some lesser-known but noteworthy ones.",
    hard: "Choose obscure, specialist-knowledge entities that would challenge experts.",
  };

  const systemPrompt = `You are a trivia game entity generator. Given a topic, produce a JSON array of ${count} unique entities related to that topic.

Each entity must have:
- "name": the entity's proper name
- "description": a 1-2 sentence factual description (DO NOT include the name in the description)
- "category": a sub-category within the topic
- "year": relevant year if applicable, otherwise omit

DIVERSITY RULES:
- Maximize variety across geography, eras, and sub-categories
- Avoid near-duplicates, variants, or same-series items
- Do not repeat the same category more than twice
- Mix mainstream and niche items for higher entropy

${difficultyGuidance[difficulty]}

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations. Just a JSON array.`;

  const userPrompt = `Topic: "${topic}"\nGenerate ${count} entities.`;

  const response = await chatCompletion(apiKey, model, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], 0.8, 8192);

  const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed: RawEntity[] = JSON.parse(cleaned);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Entity generation returned invalid data");
  }

  const limited = parsed.slice(0, count);

  // Shuffle to avoid predictable ordering
  for (let i = limited.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [limited[i], limited[j]] = [limited[j], limited[i]];
  }

  return limited;
}

export function rawEntityToEntity(raw: RawEntity, id: string, imageUrl: string, hints: [string, string, string]): Entity {
  return {
    id,
    name: raw.name,
    description: raw.description,
    category: raw.category,
    year: raw.year,
    imageUrl,
    hints,
  };
}
