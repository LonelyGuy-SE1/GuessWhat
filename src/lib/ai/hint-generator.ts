import type { Difficulty } from "@/lib/types";
import { getModelName } from "./model-router";
import { chatCompletion } from "./api-client";

export async function generateHints(
  apiKey: string,
  entityName: string,
  entityDescription: string,
  category: string,
  difficulty: Difficulty
): Promise<[string, string, string]> {
  const model = getModelName("generate_hints");

  const difficultyGuidance: Record<Difficulty, string> = {
    easy: "Hints should be fairly revealing. Hint 3 should almost give away the answer.",
    medium: "Hints should be moderately helpful. Players need some knowledge to connect them.",
    hard: "Hints should be subtle and indirect. Even Hint 3 should require expertise.",
  };

  const systemPrompt = `You generate exactly 3 ACCURATE and FACTUAL hints for a visual guessing game. The player sees an image and must guess what it is.

Generate exactly 3 hints for the given entity. Hints must be explicitly true and related to the entity. No vague nonsense.
- Hint 1: A broad but accurate factual clue (category, era, or region)
- Hint 2: A contextual factual clue (location, specific purpose, or notable feature)
- Hint 3: A highly specific, narrow clue (unique characteristic or famous association without naming the answer directly)

${difficultyGuidance[difficulty]}

CRITICAL: Hints must NEVER contain the entity name, parts of the entity name, or obvious synonyms. They must be factual and correct.
Return ONLY a JSON array of 3 strings. No markdown, no explanations.`;

  const userPrompt = `Entity: "${entityName}"
Description: "${entityDescription}"
Category: "${category}"`;

  const response = await chatCompletion(apiKey, model, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], 0.7, 1024);

  const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed: string[] = JSON.parse(cleaned);

  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error("Hint generation returned invalid data");
  }

  return [parsed[0], parsed[1], parsed[2]];
}

export async function generateHintsBatch(
  apiKey: string,
  entities: { name: string; description: string; category: string }[],
  difficulty: Difficulty
): Promise<[string, string, string][]> {
  // Process in parallel batches of 5 to balance speed and rate limits
  const batchSize = 5;
  const results: [string, string, string][] = [];

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((e) => generateHints(apiKey, e.name, e.description, e.category, difficulty))
    );
    results.push(...batchResults);
  }

  return results;
}
