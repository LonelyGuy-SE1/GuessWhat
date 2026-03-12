import type { Entity, Difficulty, GameDataset } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { generateEntities, rawEntityToEntity } from "./entity-generator";
import { generateHints } from "./hint-generator";
import { generateEntityImage } from "./image-pipeline";

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
 * Generate a single entity's image and hints in parallel
 */
async function processEntity(
  apiKey: string,
  raw: { name: string; description: string; category: string; year?: string },
  difficulty: Difficulty
): Promise<Entity> {
  // Run image and hints generation in parallel for this entity
  const [imageUrl, hints] = await Promise.all([
    generateEntityImage(apiKey, raw.name, raw.description, raw.category),
    generateHints(apiKey, raw.name, raw.description, raw.category, difficulty),
  ]);

  return rawEntityToEntity(raw, generateId(), imageUrl, hints);
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

/**
 * Progressive generation - returns minimal dataset quickly, continues in background
 * Use this when you want to start playing immediately.
 */
export async function generateGameDatasetProgressive(
  apiKey: string,
  topic: string,
  difficulty: Difficulty,
  totalCount: number = 10,
  minReadyToStart: number = 3,
  onProgress?: (progress: GenerationProgress) => void,
  onReadyToPlay?: (partialDataset: GameDataset) => void
): Promise<GameDataset> {
  // Step 1: Generate entity list
  onProgress?.({
    phase: "entities",
    entitiesGenerated: 0,
    entitiesTotal: totalCount,
    entitiesReady: 0,
    message: "Generating entity list...",
  });

  const rawEntities = await generateEntities(apiKey, topic, totalCount, difficulty);
  const actualCount = rawEntities.length;

  onProgress?.({
    phase: "processing",
    entitiesGenerated: actualCount,
    entitiesTotal: actualCount,
    entitiesReady: 0,
    message: `Processing ${actualCount} entities in parallel...`,
  });

  // Process all in parallel, track completion
  const entities: Entity[] = new Array(actualCount);
  let readyCount = 0;
  let signalSent = false;

  const promises = rawEntities.map(async (raw, index) => {
    const entity = await processEntity(apiKey, raw, difficulty);
    entities[index] = entity;
    readyCount++;

    onProgress?.({
      phase: "processing",
      entitiesGenerated: actualCount,
      entitiesTotal: actualCount,
      entitiesReady: readyCount,
      message: `Ready: ${readyCount}/${actualCount}`,
    });

    // Signal ready to play once we have minimum entities
    if (readyCount >= minReadyToStart && !signalSent) {
      signalSent = true;
      const readyEntities = entities.filter((e) => e !== undefined);
      onReadyToPlay?.({
        topic,
        entities: readyEntities,
        createdAt: Date.now(),
      });
    }
  });

  await Promise.all(promises);

  onProgress?.({
    phase: "ready",
    entitiesGenerated: actualCount,
    entitiesTotal: actualCount,
    entitiesReady: actualCount,
    message: "All rounds ready!",
  });

  return {
    topic,
    entities,
    createdAt: Date.now(),
  };
}
