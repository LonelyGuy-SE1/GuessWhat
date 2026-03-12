import type { ModelTask, ModelChoice } from "@/lib/types";

/**
 * Model routing strategy: selects the best model for each task
 * based on cost, capability, and speed trade-offs.
 *
 * Models from Commonstack model library.
 * Format: provider/model-name
 * 
 * Strategy:
 * - Orchestrator uses a capable model to interpret prompts
 * - Subtasks routed to cheapest adequate models
 */

const MODEL_MAP: Record<ModelTask, ModelChoice> = {
  orchestrate: {
    model: "google/gemini-2.5-pro",
    task: "orchestrate",
    reason: "Strong reasoning for prompt interpretation ($1.25/M input)",
  },
  generate_entities: {
    model: "openai/gpt-4o-mini",
    task: "generate_entities",
    reason: "Cheapest option with good JSON generation ($0.15/M input)",
  },
  generate_hints: {
    model: "openai/gpt-4o-mini",
    task: "generate_hints",
    reason: "Cheapest option for creative text ($0.15/M input)",
  },
  validate_image: {
    model: "google/gemini-2.5-flash",
    task: "validate_image",
    reason: "Vision-capable at low cost ($0.30/M input)",
  },
  generate_image: {
    model: "google/gemini-3-pro-image-preview",
    task: "generate_image",
    reason: "Gemini image generation model",
  },
};

export function getModelForTask(task: ModelTask): ModelChoice {
  return MODEL_MAP[task];
}

export function getModelName(task: ModelTask): string {
  return MODEL_MAP[task].model;
}

export function getAllModelChoices(): ModelChoice[] {
  return Object.values(MODEL_MAP);
}
