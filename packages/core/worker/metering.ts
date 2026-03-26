/**
 * Token usage metering service.
 *
 * Simulates token counts based on task complexity and records to usage_records.
 * Cost calculation uses Claude Sonnet pricing: $3/M input, $15/M output.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskPriority } from "../types/index";

interface TokenEstimate {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface UsageSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostCents: number;
  byAgent: Array<{
    agentId: string;
    promptTokens: number;
    completionTokens: number;
    costCents: number;
  }>;
}

// ---------------------------------------------------------------------------
// Token estimation by task complexity
// ---------------------------------------------------------------------------

/**
 * Base token counts by task priority (used as complexity proxy).
 *
 * - low (simple query/lookup): ~200 prompt + ~100 completion
 * - medium (draft/create): ~500 prompt + ~300 completion
 * - high (multi-step/complex): ~1000 prompt + ~600 completion
 */
const BASE_TOKENS: Record<string, TokenEstimate> = {
  low: { prompt_tokens: 200, completion_tokens: 100 },
  medium: { prompt_tokens: 500, completion_tokens: 300 },
  high: { prompt_tokens: 1000, completion_tokens: 600 },
};

/**
 * Estimate token usage for a task based on its priority and tool count.
 *
 * Each additional tool adds ~150 prompt + ~80 completion tokens.
 * Adds small random variance (up to 10%) for realistic simulation.
 */
export function estimateTokens(
  taskPriority: TaskPriority,
  toolCount: number,
): TokenEstimate {
  const base = BASE_TOKENS[taskPriority] ?? BASE_TOKENS.medium;
  const toolMultiplier = Math.max(1, toolCount);

  // Each tool adds incremental tokens
  const promptTokens = base.prompt_tokens + (toolMultiplier - 1) * 150;
  const completionTokens = base.completion_tokens + (toolMultiplier - 1) * 80;

  // Add small variance (up to 10%) for realistic simulation
  const variance = () => 1 + (Math.random() * 0.2 - 0.1); // 0.9 to 1.1

  return {
    prompt_tokens: Math.round(promptTokens * variance()),
    completion_tokens: Math.round(completionTokens * variance()),
  };
}

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

/**
 * Model pricing in dollars per million tokens.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet": { input: 3, output: 15 },
  "claude-haiku": { input: 0.25, output: 1.25 },
  "claude-opus": { input: 15, output: 75 },
};

/**
 * Calculate cost in cents from token counts.
 *
 * Default model is 'claude-sonnet': $3/M input, $15/M output.
 * Returns cost rounded to nearest cent.
 */
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model = "claude-sonnet",
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet"];

  const inputCostDollars = (promptTokens / 1_000_000) * pricing.input;
  const outputCostDollars = (completionTokens / 1_000_000) * pricing.output;
  const totalCents = (inputCostDollars + outputCostDollars) * 100;

  return Math.round(totalCents);
}

// ---------------------------------------------------------------------------
// Record usage
// ---------------------------------------------------------------------------

/**
 * Record token usage to the usage_records table.
 *
 * Best-effort: errors are logged but not thrown, to avoid failing
 * the task execution if metering fails.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  businessId: string,
  taskId: string | null,
  agentId: string,
  tokens: TokenEstimate,
  model = "claude-sonnet",
): Promise<void> {
  const costCents = calculateCost(tokens.prompt_tokens, tokens.completion_tokens, model);

  try {
    const { error } = await supabase.from("usage_records").insert({
      business_id: businessId,
      task_id: taskId,
      agent_id: agentId,
      model,
      prompt_tokens: tokens.prompt_tokens,
      completion_tokens: tokens.completion_tokens,
      cost_cents: costCents,
    });

    if (error) {
      console.error("Failed to record usage:", error.message);
    }
  } catch (err) {
    console.error(
      "Failed to record usage:",
      err instanceof Error ? err.message : "Unknown error",
    );
  }
}

// ---------------------------------------------------------------------------
// Usage summary
// ---------------------------------------------------------------------------

/**
 * Get aggregated usage summary for a business.
 *
 * Returns total tokens, total cost, and per-agent breakdown.
 * Optionally filtered by date range.
 */
export async function getUsageSummary(
  supabase: SupabaseClient,
  businessId: string,
  period?: { from: Date; to: Date },
): Promise<UsageSummary> {
  let query = supabase
    .from("usage_records")
    .select("agent_id, prompt_tokens, completion_tokens, cost_cents")
    .eq("business_id", businessId);

  if (period) {
    query = query
      .gte("created_at", period.from.toISOString())
      .lte("created_at", period.to.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch usage summary: ${error.message}`);
  }

  const records = data ?? [];

  // Aggregate totals
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostCents = 0;
  const agentMap = new Map<
    string,
    { promptTokens: number; completionTokens: number; costCents: number }
  >();

  for (const record of records) {
    totalPromptTokens += record.prompt_tokens;
    totalCompletionTokens += record.completion_tokens;
    totalCostCents += record.cost_cents;

    const existing = agentMap.get(record.agent_id) ?? {
      promptTokens: 0,
      completionTokens: 0,
      costCents: 0,
    };
    existing.promptTokens += record.prompt_tokens;
    existing.completionTokens += record.completion_tokens;
    existing.costCents += record.cost_cents;
    agentMap.set(record.agent_id, existing);
  }

  return {
    totalPromptTokens,
    totalCompletionTokens,
    totalCostCents,
    byAgent: Array.from(agentMap.entries()).map(([agentId, stats]) => ({
      agentId,
      ...stats,
    })),
  };
}
