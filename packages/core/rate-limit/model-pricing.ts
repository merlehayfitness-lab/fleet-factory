/**
 * Model pricing constants and cost calculation.
 *
 * Per-million-token pricing by model for all supported providers.
 * Plan tier limits for concurrency and monthly token budgets.
 */

/** Per-million-token pricing by model. Input = prompt cost, output = completion cost. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  // Aliases (backward compat)
  "claude-sonnet": { input: 3, output: 15 },
  "claude-haiku": { input: 1, output: 5 },
  "claude-opus": { input: 5, output: 25 },
  "openclaw/default": { input: 3, output: 15 }, // Maps to Sonnet on VPS
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  // Google
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  // Mistral
  "mistral-large": { input: 2, output: 6 },
  "mistral-small": { input: 0.2, output: 0.6 },
  // DeepSeek
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  // Fallback
  default: { input: 3, output: 15 },
};

/** Plan tier concurrency and token limits. */
export const PLAN_LIMITS: Record<
  string,
  { maxConcurrent: number; monthlyTokens: number | null }
> = {
  trial: { maxConcurrent: 1, monthlyTokens: 100_000 },
  starter: { maxConcurrent: 3, monthlyTokens: 1_000_000 },
  pro: { maxConcurrent: 5, monthlyTokens: 3_000_000 },
  enterprise: { maxConcurrent: 10, monthlyTokens: null },
};

/** Calculate cost in cents from token counts and model. */
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: string,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["default"];
  const inputCostDollars = (promptTokens / 1_000_000) * pricing.input;
  const outputCostDollars = (completionTokens / 1_000_000) * pricing.output;
  return Math.round((inputCostDollars + outputCostDollars) * 10000) / 100;
}
