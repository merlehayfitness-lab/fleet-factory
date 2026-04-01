/**
 * Rate limit service for API calls.
 *
 * DB-backed slot counting via api_call_queue (status=processing).
 * Tier-aware concurrency limits from business plan_tier.
 * Budget checking before slot acquisition.
 * All completed calls logged to api_usage for cost tracking.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateCost } from "./model-pricing";
import { PLAN_LIMITS } from "./model-pricing";
import { checkBudget } from "./budget-service";
import type { BudgetCheckResult } from "./budget-service";

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
  maxConcurrent: 5,
  staggerMs: 2000,
  maxQueueSize: 100,
  maxRetries: 3,
};

// ---------------------------------------------------------------------------
// Per-business stagger tracking (non-critical, in-memory is fine)
// ---------------------------------------------------------------------------

const lastCallByBusiness = new Map<string, number>();

// ---------------------------------------------------------------------------
// DB-backed slot counting
// ---------------------------------------------------------------------------

/**
 * Get the current number of active (in-flight) API calls from the database.
 */
export async function getActiveSlotCount(
  supabase: SupabaseClient,
): Promise<number> {
  const { count } = await supabase
    .from("api_call_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "processing");
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Slot acquisition with DB-backed counting and tier-aware limits
// ---------------------------------------------------------------------------

/**
 * Acquire a rate-limit slot. Checks plan tier concurrency limit for the business.
 * Creates a processing entry in api_call_queue to claim the slot.
 * Returns the slot ID on success, or null if no slot available.
 */
export async function acquireSlot(
  supabase: SupabaseClient,
  businessId: string,
  config?: Partial<RateLimitConfig>,
): Promise<string | null> {
  // 1. Get business plan tier
  const { data: business } = await supabase
    .from("businesses")
    .select("plan_tier")
    .eq("id", businessId)
    .single();
  const tier = (business?.plan_tier as string) ?? "starter";
  const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS["starter"];
  const maxConcurrent = config?.maxConcurrent ?? limits.maxConcurrent;
  const staggerMs = config?.staggerMs ?? DEFAULT_CONFIG.staggerMs;

  // 2. Check current active count from DB
  const active = await getActiveSlotCount(supabase);
  if (active >= maxConcurrent) return null;

  // 3. Enforce per-business stagger delay
  const now = Date.now();
  const lastCall = lastCallByBusiness.get(businessId) ?? 0;
  const elapsed = now - lastCall;
  if (elapsed < staggerMs && lastCall > 0) {
    const waitMs = staggerMs - elapsed;
    await sleep(waitMs);
  }

  // 4. Create a processing entry to "claim" the slot
  const { data, error } = await supabase
    .from("api_call_queue")
    .insert({
      business_id: businessId,
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) return null;

  lastCallByBusiness.set(businessId, Date.now());
  return data.id;
}

/**
 * Release a rate-limit slot by marking the queue entry as completed.
 */
export async function releaseSlot(
  supabase: SupabaseClient,
  slotId: string,
): Promise<void> {
  const { error } = await supabase
    .from("api_call_queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", slotId);

  if (error) {
    console.error(`Failed to release slot ${slotId}:`, error.message);
  }
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
    keySource?: "platform" | "business";
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
      key_source: params.keySource ?? null,
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
// High-level: execute with rate limiting + budget checks
// ---------------------------------------------------------------------------

/**
 * Execute an API call with rate limiting and budget enforcement.
 *
 * 1. Check budget (agent + business level)
 * 2. Try to acquire a DB-backed slot
 * 3. If acquired, execute; otherwise enqueue
 * 4. After execution, attempt to drain one queued item (best-effort)
 *
 * Returns either:
 * - executed: true with result and usage
 * - executed: false with queueId and position (rate-limited)
 * - executed: false with reason "budget_exceeded" (over budget)
 */
export async function executeWithRateLimit<T>(
  supabase: SupabaseClient,
  params: {
    businessId: string;
    agentId?: string;
    model?: string;
    provider?: string;
  },
  fn: () => Promise<{ result: T; usage: ApiCallResult }>,
  config?: Partial<RateLimitConfig>,
): Promise<
  | { executed: true; result: T; usage: ApiCallResult }
  | { executed: false; queueId: string; queuePosition: number }
  | { executed: false; reason: "budget_exceeded"; budgetInfo: BudgetCheckResult }
> {
  // 1. Budget check
  const budgetResult = await checkBudget(supabase, params.businessId, params.agentId);
  if (!budgetResult.allowed) {
    return { executed: false, reason: "budget_exceeded", budgetInfo: budgetResult };
  }

  // 2. Acquire DB-backed slot
  const slotId = await acquireSlot(supabase, params.businessId, config);

  if (!slotId) {
    // Enqueue for later processing
    const queueId = await enqueueCall(supabase, {
      businessId: params.businessId,
      agentId: params.agentId,
      payload: { model: params.model ?? "claude-sonnet" },
      priority: 0,
    });

    const queuePosition = await getQueueDepth(supabase);

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

    return { executed: false, queueId, queuePosition };
  }

  const startMs = Date.now();
  try {
    const { result, usage } = await fn();

    const costCents = calculateCost(usage.promptTokens, usage.completionTokens, usage.model);

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
    // Release slot
    await releaseSlot(supabase, slotId);

    // Best-effort: try to drain one queued item
    try {
      const next = await dequeueCall(supabase);
      if (next) {
        // Queue drain: item is now marked as processing,
        // the queued call's poller will pick it up on next retry
      }
    } catch {
      /* best-effort */
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
