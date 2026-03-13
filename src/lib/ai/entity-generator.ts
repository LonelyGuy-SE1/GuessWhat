import type { Entity, Difficulty } from "@/lib/types";
import { getModelName } from "./model-router";
import { chatCompletion } from "./api-client";

interface RawEntity {
  name: string;
  acceptedAnswers: string[];
  imageUrl?: string;
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
    easy: `EASY DIFFICULTY — Choose entities that are universally well-known:
- Household names, iconic landmarks, famous celebrities, popular animals
- Things a casual person with no special knowledge would recognize from an image
- Examples for "countries": USA, France, Japan. For "animals": dog, elephant, lion.
- The image alone should be enough for most people to guess correctly`,
    medium: `MEDIUM DIFFICULTY — Mix well-known with moderately challenging:
- About half should be recognizable to most people, half should require some knowledge
- Include some entities that are well-known within their field but not universally famous
- Examples for "countries": Croatia, Peru, Vietnam. For "animals": pangolin, axolotl, capybara.`,
    hard: `HARD DIFFICULTY — Choose obscure, expert-level entities:
- Specialist knowledge required. Most people would NOT recognize these from an image alone
- Deep cuts, niche entries, lesser-known variants
- Examples for "countries": Eswatini, Comoros, Nauru. For "animals": fossa, tarsier, okapi.
- Even with hints, these should challenge knowledgeable players`,
  };

  const systemPrompt = `You are a trivia game entity generator. Given a topic, produce a JSON array of ${count} unique entities related to that topic.

NAMING RULES (CRITICAL):
- "name" must be the SHORT, core identifying name — NOT prefixed with the topic.
- If the topic is "flags", name the entity "Bhutan" NOT "Flag of Bhutan"
- If the topic is "landmarks", name it "Colosseum" NOT "The Colosseum of Rome"
- If the topic is "movies", name it "Inception" NOT "The Movie Inception"
- The name should be what a player would naturally type as their guess

Each entity must have:
- "name": the entity's short, core identifying name (see naming rules above)
- "acceptedAnswers": an array of 3-6 alternative valid answers a human might type. Include:
  * Common abbreviations or nicknames
  * Partial names (e.g. last name only for a person)
  * Casual/colloquial names
  * Spelling variants or transliterations
  * The full formal name if "name" is a short version
- "imageUrl": a direct URL to a real, publicly accessible image of this entity (e.g., from Wikimedia Commons, Wikipedia, or official sources). ONLY provide this if you are 100% certain the URL exists and is correct. If you are NOT sure, OMIT this field entirely — do NOT guess or fabricate URLs.
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
    acceptedAnswers: raw.acceptedAnswers || [],
  };
}
