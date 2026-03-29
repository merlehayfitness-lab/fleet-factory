/**
 * Claude model constants -- single source of truth for model metadata.
 *
 * Used by metering, prompt generators, test chat, and UI model selectors.
 */

export interface ClaudeModel {
  id: string;           // API model ID: "claude-opus-4-6"
  friendlyName: string; // Display name: "Claude Opus 4.6"
  tier: "opus" | "sonnet" | "haiku";
  generation: string;   // "4.6", "4.5", "4.0"
  pricing: { input: number; output: number }; // per MTok in $
  isLatest: boolean;
}

/**
 * All supported Claude models. 3 latest + 3 legacy.
 */
export const CLAUDE_MODELS: ClaudeModel[] = [
  // Latest models
  {
    id: "claude-opus-4-6",
    friendlyName: "Claude Opus 4.6",
    tier: "opus",
    generation: "4.6",
    pricing: { input: 5, output: 25 },
    isLatest: true,
  },
  {
    id: "claude-sonnet-4-6",
    friendlyName: "Claude Sonnet 4.6",
    tier: "sonnet",
    generation: "4.6",
    pricing: { input: 3, output: 15 },
    isLatest: true,
  },
  {
    id: "claude-haiku-4-5-20251001",
    friendlyName: "Claude Haiku 4.5",
    tier: "haiku",
    generation: "4.5",
    pricing: { input: 1, output: 5 },
    isLatest: true,
  },
  // Legacy models
  {
    id: "claude-sonnet-4-5-20250929",
    friendlyName: "Claude Sonnet 4.5",
    tier: "sonnet",
    generation: "4.5",
    pricing: { input: 3, output: 15 },
    isLatest: false,
  },
  {
    id: "claude-opus-4-5-20251101",
    friendlyName: "Claude Opus 4.5",
    tier: "opus",
    generation: "4.5",
    pricing: { input: 5, output: 25 },
    isLatest: false,
  },
  {
    id: "claude-sonnet-4-20250514",
    friendlyName: "Claude Sonnet 4.0",
    tier: "sonnet",
    generation: "4.0",
    pricing: { input: 3, output: 15 },
    isLatest: false,
  },
];

/**
 * Default model assignment per department type.
 * Owner gets opus (oversight), sales/ops get sonnet, support gets haiku (high volume).
 */
export const DEPARTMENT_DEFAULT_MODELS: Record<string, string> = {
  owner: "claude-opus-4-6",
  sales: "claude-sonnet-4-6",
  support: "claude-haiku-4-5-20251001",
  operations: "claude-sonnet-4-6",
};

/**
 * Find a model by its API ID.
 */
export function getModelById(modelId: string): ClaudeModel | undefined {
  return CLAUDE_MODELS.find((m) => m.id === modelId);
}

/**
 * Get the friendly display name for a model ID.
 * Falls back to the raw ID if not found.
 */
export function getModelFriendlyName(modelId: string): string {
  return getModelById(modelId)?.friendlyName ?? modelId;
}

/**
 * Get only the latest (current) models.
 */
export function getLatestModels(): ClaudeModel[] {
  return CLAUDE_MODELS.filter((m) => m.isLatest);
}

/**
 * Get the default model ID for a department type.
 * Falls back to sonnet for unknown departments.
 */
export function getDefaultModelForDepartment(departmentType: string): string {
  return DEPARTMENT_DEFAULT_MODELS[departmentType] ?? "claude-sonnet-4-6";
}
