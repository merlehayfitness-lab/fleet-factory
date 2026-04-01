/**
 * Rate limit service for API calls.
 *
 * Enforces max concurrent calls (default 3), 2-second stagger between calls,
 * and an overflow queue backed by Supabase's api_call_queue table.
 * All completed calls are logged to api_usage for cost tracking.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  maxConcurrent: number;
  staggerMs: number;
  maxQueueSize: number;
  maxRetries: number;
}

export interface ApiCallResult {
  promptTokens: number;
  completionTokens: number;
  model: string;
  provider: string;
  latencyMs: number;
}

export interface QueuedCall {
  id: string;
  businessId: string | null;
  agentId: string | null;
  payload: Record<string, unknown>;
  priority: number;
  status: string;
  attempts: number;
  createdAt: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxConcurrent: 3,
  staggerMs: 2000,
  maxQueueSize: 100,
  maxRetries: 3,
};

// ---------------------------------------------------------------------------
// In-memory concurrency tracking
// ---------------------------------------------------------------------------

let activeSlots = 0;
let lastCallTimestamp = 0;

/**
 * Get the current number of active (in-flight) API calls.
 */
export function getActiveSlotCount(): number {
  return activeSlots;
}

// ---------------------------------------------------------------------------
// Slot acquisition with stagger
// ---------------------------------------------------------------------------

/**
 * Acquire a rate-limit slot. Waits for stagger delay if needed.
 * Returns false if max concurrent slots are already occupied.
 */
export async function acquireSlot(
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<boolean> {
  if (activeSlots >= config.maxConcurrent) {
    return false;
  }

  // Enforce stagger delay
  const now = Date.now();
  const elapsed = now - lastCallTimestamp;
  if (elapsed < config.staggerMs && lastCallTimestamp > 0) {
    const waitMs = config.staggerMs - elapsed;
    await sleep(waitMs);
  }

  activeSlots++;
  lastCallTimestamp = Date.now();
  return true;
}

/**
 * Release a rate-limit slot after API call completes.
 */
export function releaseSlot(): void {
  activeSlots = Math.max(0, activeSlots - 1);
}

// ---------------------------------------------------------------------------
// Queue operations (Supabase-backed)
// ---------------------------------------------------------------------------

/**
 * Enqueue an API call that couldn't get a slot.
 * Stored in api_call_queue table for later processing.
 */
export async function enqueueCall(
  supabase: SupabaseClient,
  params: {
    businessId?: string;
    agentId?: string;
    payload: Record<string, unknown>;
    priority?: number;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("api_call_queue")
    .insert({
      business_id: params.businessId ?? null,
      agent_id: params.agentId ?? null,
      payload: params.payload,
      priority: params.priority ?? 0,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to enqueue API call: ${error.message}`);
  }

  return data.id;
}

/**
 * Dequeue the next pending call (highest priority, oldest first).
 */
export async function dequeueCall(
  supabase: SupabaseClient,
): Promise<QueuedCall | null> {
  const { data, error } = await supabase
    .from("api_call_queue")
    .select("*")
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    throw new Error(`Failed to dequeue API call: ${error.message}`);
  }

  if (!data) return null;

  // Mark as processing
  const { error: updateError } = await supabase
    .from("api_call_queue")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      attempts: data.attempts + 1,
    })
    .eq("id", data.id)
    .eq("status", "pending"); // Optimistic lock

  if (updateError) {
    return null; // Another process grabbed it
  }

  return {
    id: data.id,
    businessId: data.business_id,
    agentId: data.agent_id,
    payload: data.payload,
    priority: data.priority,
    status: "processing",
    attempts: data.attempts + 1,
    createdAt: data.created_at,
  };
}

/**
 * Mark a queued call as completed.
 */
export async function completeQueuedCall(
  supabase: SupabaseClient,
  callId: string,
): Promise<void> {
  const { error } = await supabase
    .from("api_call_queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", callId);

  if (error) {
    console.error(`Failed to complete queued call ${callId}:`, error.message);
  }
}

/**
 * Mark a queued call as failed.
 */
export async function failQueuedCall(
  supabase: SupabaseClient,
  callId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase
    .from("api_call_queue")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", callId);

  if (error) {
    console.error(`Failed to mark queued call ${callId} as failed:`, error.message);
  }
}

/**
 * Get current queue depth (pending calls).
 */
export async function getQueueDepth(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("api_call_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("Failed to get queue depth:", error.message);
    return 0;
  }

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Usage logging
// ---------------------------------------------------------------------------

/**
 * Log an API call to api_usage table.
 * Best-effort: errors are logged but not thrown.
 */
export async function logApiUsage(
  supabase: SupabaseClient,
  params: {
    businessId?: string;
    agentId?: string;
    model: string;
    provider?: string;
    promptTokens: number;
    completionTokens: number;
    costCents: number;
    latencyMs?: number;
    status?: "completed" | "failed" | "rate_limited" | "queued";
    errorMessage?: string;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("api_usage").insert({
      business_id: params.businessId ?? null,
      agent_id: params.agentId ?? null,
      model: params.model,
      provider: params.provider ?? "anthropic",
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      cost_cents: params.costCents,
      latency_ms: params.latencyMs ?? null,
      status: params.status ?? "completed",
      error_message: params.errorMessage ?? null,
    });

    if (error) {
      console.error("Failed to log API usage:", error.message);
    }
  } catch (err) {
    console.error(
      "Failed to log API usage:",
      err instanceof Error ? err.message : "Unknown error",
    );
  }
}

/**
 * Get usage summary from api_usage for a business within a period.
 */
export async function getApiUsageSummary(
  supabase: SupabaseClient,
  businessId: string,
  period?: { from: Date; to: Date },
): Promise<{
  totalCalls: number;
  totalTokens: number;
  totalCostCents: number;
  failedCalls: number;
  rateLimitedCalls: number;
}> {
  let query = supabase
    .from("api_usage")
    .select("prompt_tokens, completion_tokens, cost_cents, status")
    .eq("business_id", businessId);

  if (period) {
    query = query
      .gte("created_at", period.from.toISOString())
      .lte("created_at", period.to.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch API usage summary: ${error.message}`);
  }

  const records = data ?? [];
  let totalCalls = 0;
  let totalTokens = 0;
  let totalCostCents = 0;
  let failedCalls = 0;
  let rateLimitedCalls = 0;

  for (const r of records) {
    totalCalls++;
    totalTokens += r.prompt_tokens + r.completion_tokens;
    totalCostCents += Number(r.cost_cents);
    if (r.status === "failed") failedCalls++;
    if (r.status === "rate_limited") rateLimitedCalls++;
  }

  return { totalCalls, totalTokens, totalCostCents, failedCalls, rateLimitedCalls };
}

// ---------------------------------------------------------------------------
// High-level: execute with rate limiting
// ---------------------------------------------------------------------------

/**
 * Execute an API call with rate limiting.
 *
 * Tries to acquire a slot. If successful, executes the call immediately.
 * If not, enqueues the call and returns a queue ID.
 *
 * Returns either the call result (if executed) or a queue entry (if enqueued).
 */
export async function executeWithRateLimit<T>(
  supabase: SupabaseClient,
  params: {
    businessId?: string;
    agentId?: string;
    model?: string;
    provider?: string;
  },
  fn: () => Promise<{ result: T; usage: ApiCallResult }>,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<
  | { executed: true; result: T; usage: ApiCallResult }
  | { executed: false; queueId: string }
> {
  const acquired = await acquireSlot(config);

  if (!acquired) {
    // Enqueue for later processing
    const queueId = await enqueueCall(supabase, {
      businessId: params.businessId,
      agentId: params.agentId,
      payload: { model: params.model ?? "claude-sonnet" },
      priority: 0,
    });

    // Log rate-limited event
    await logApiUsage(supabase, {
      businessId: params.businessId,
      agentId: params.agentId,
      model: params.model ?? "claude-sonnet",
      provider: params.provider ?? "anthropic",
      promptTokens: 0,
      completionTokens: 0,
      costCents: 0,
      status: "rate_limited",
    });

    return { executed: false, queueId };
  }

  const startMs = Date.now();
  try {
    const { result, usage } = await fn();

    const costCents = calculateCostFromUsage(usage);

    // Log successful usage
    await logApiUsage(supabase, {
      businessId: params.businessId,
      agentId: params.agentId,
      model: usage.model,
      provider: usage.provider,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      costCents,
      latencyMs: usage.latencyMs,
      status: "completed",
    });

    return { executed: true, result, usage };
  } catch (err) {
    const latencyMs = Date.now() - startMs;

    // Log failed usage
    await logApiUsage(supabase, {
      businessId: params.businessId,
      agentId: params.agentId,
      model: params.model ?? "claude-sonnet",
      provider: params.provider ?? "anthropic",
      promptTokens: 0,
      completionTokens: 0,
      costCents: 0,
      latencyMs,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });

    throw err;
  } finally {
    releaseSlot();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Per-MTok pricing for cost calculation */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet": { input: 3, output: 15 },
  "claude-haiku": { input: 1, output: 5 },
  "claude-opus": { input: 5, output: 25 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  default: { input: 3, output: 15 },
};

function calculateCostFromUsage(usage: ApiCallResult): number {
  const pricing = MODEL_PRICING[usage.model] ?? MODEL_PRICING["default"];
  const inputCostDollars = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCostDollars = (usage.completionTokens / 1_000_000) * pricing.output;
  return Math.round((inputCostDollars + outputCostDollars) * 10000) / 100; // 2 decimal cents
}
