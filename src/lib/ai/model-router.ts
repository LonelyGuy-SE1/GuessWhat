import type { ModelTask } from "@/lib/types";

/**
 * Model routing: selects the best model for each AI task.
 * Models from Commonstack model library (provider/model-name format).
 */

const MODEL_MAP: Record<ModelTask, { model: string; reason: string }> = {
  generate_entities: {
    model: "openai/gpt-4o-mini",
    reason: "Cheapest option with good JSON generation ($0.15/M input)",
  },
  generate_hints: {
    model: "openai/gpt-4o-mini",
    reason: "Cheapest option for creative text ($0.15/M input)",
  },
  generate_image: {
    model: "google/gemini-3-pro-image-preview",
    reason: "Gemini image generation model",
  },
};

export function getModelName(task: ModelTask): string {
  return MODEL_MAP[task].model;
}
