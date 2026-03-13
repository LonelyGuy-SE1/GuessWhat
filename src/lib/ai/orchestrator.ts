import type { Entity, Difficulty, GameDataset } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { generateEntities, rawEntityToEntity } from "./entity-generator";
import { generateHints } from "./hint-generator";
import { generateEntityImage, searchWikipediaImage } from "./image-pipeline";

/**
 * Progress callback for tracking generation status
 */
export interface GenerationProgress {
  phase: "entities" | "processing" | "ready";
  entitiesGenerated: number;
  entitiesTotal: number;
  entitiesReady: number; // Fully processed (has image + hints)
  message: string;
}

/**
 * Safely verify if an image URL is alive without hitting CORS issues in browser
 */
async function verifyImageUrl(url: string): Promise<boolean> {
  if (typeof window !== "undefined") {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  } else {
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok && (res.headers.get("content-type")?.startsWith("image/") ?? true);
    } catch {
      return false;
    }
  }
}

/**
 * Generate a single entity's image and hints in parallel.
 *
 * Image strategy (3-tier, prioritizes real images):
 * 1. LLM-provided URL (if the entity generator returned one and it's valid)
 * 2. Wikipedia image search (free, works well for well-known subjects)
 * 3. AI image generation via Gemini (fallback for obscure/custom subjects)
 */
async function processEntity(
  apiKey: string,
  raw: { name: string; description: string; category: string; year?: string; acceptedAnswers: string[]; imageUrl?: string },
  difficulty: Difficulty
): Promise<Entity> {
  const imagePromise = (async () => {
    // Tier 1: Try LLM-provided URL
    if (raw.imageUrl && raw.imageUrl.startsWith("http")) {
      const isValid = await verifyImageUrl(raw.imageUrl);
      if (isValid) return raw.imageUrl;
    }

    // Tier 2: Search Wikipedia for a real image (free, no API key needed)
    const wikiImage = await searchWikipediaImage(raw.name);
    if (wikiImage) {
      const isValid = await verifyImageUrl(wikiImage);
      if (isValid) return wikiImage;
    }

    // Tier 3: Fall back to AI image generation
    return generateEntityImage(apiKey, raw.name, raw.description, raw.category);
  })();

  // Run image and hints generation in parallel for this entity
  const [imageUrl, hints] = await Promise.all([
    imagePromise,
    generateHints(apiKey, raw.name, raw.description, raw.category, difficulty),
  ]);

  return rawEntityToEntity(raw as any, generateId(), imageUrl, hints);
}

/**
 * Main AI Orchestrator - Parallel & Progressive
 *
 * Pipeline:
 * 1. Generate entity list (single API call)
 * 2. Process all entities in parallel (image + hints simultaneously per entity)
 * 3. Report progress via callback
 *
 * Commonstack supports high parallelism - we blast all requests at once.
 */
export async function generateGameDataset(
  apiKey: string,
  topic: string,
  difficulty: Difficulty,
  entityCount: number = 10,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GameDataset> {
  // Step 1: Generate entity list
  onProgress?.({
    phase: "entities",
    entitiesGenerated: 0,
    entitiesTotal: entityCount,
    entitiesReady: 0,
    message: "Generating entity list...",
  });

  const rawEntities = await generateEntities(apiKey, topic, entityCount, difficulty);
  const actualCount = rawEntities.length;

  onProgress?.({
    phase: "processing",
    entitiesGenerated: actualCount,
    entitiesTotal: actualCount,
    entitiesReady: 0,
    message: `Processing ${actualCount} entities...`,
  });

  // Step 2: Process ALL entities in parallel (Commonstack handles it)
  let readyCount = 0;
  const entityPromises = rawEntities.map(async (raw) => {
    const entity = await processEntity(apiKey, raw, difficulty);
    readyCount++;
    onProgress?.({
      phase: "processing",
      entitiesGenerated: actualCount,
      entitiesTotal: actualCount,
      entitiesReady: readyCount,
      message: `Ready: ${readyCount}/${actualCount}`,
    });
    return entity;
  });

  const entities = await Promise.all(entityPromises);

  onProgress?.({
    phase: "ready",
    entitiesGenerated: actualCount,
    entitiesTotal: actualCount,
    entitiesReady: actualCount,
    message: "Game ready!",
  });

  return {
    topic,
    entities,
    createdAt: Date.now(),
  };
}


