/**
 * Budget enforcement service.
 *
 * Checks agent-level and business-level token budgets before allowing API calls.
 * Returns utilization percentages and warning levels (amber at 80%, red/blocked at 100%).
 *
 * Best-effort: budget check failure should NOT block the API call (log and allow).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_LIMITS } from "./model-pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  agentUtilization?: number; // 0-100 percent
  businessUtilization?: number; // 0-100 percent
  warningLevel?: "none" | "amber" | "red";
  agentTokensUsed?: number;
  agentTokenBudget?: number;
  businessTokensUsed?: number;
  businessTokenLimit?: number;
}

// ---------------------------------------------------------------------------
// Budget checking
// ---------------------------------------------------------------------------

/**
 * Check if an agent/business is within budget to make an API call.
 * Returns allowed: false if agent or business has hit 100% of their budget.
 * Returns warningLevel: "amber" if at 80%+.
 *
 * Best-effort: any DB error returns allowed: true to avoid blocking calls.
 */
export async function checkBudget(
  supabase: SupabaseClient,
  businessId: string,
  agentId?: string,
): Promise<BudgetCheckResult> {
  try {
    // 1. Get business plan_tier and monthly_token_limit
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("plan_tier, monthly_token_limit")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      console.error("Budget check: failed to fetch business", bizError?.message);
      return { allowed: true, warningLevel: "none" };
    }

    const tier = (business.plan_tier as string) ?? "starter";
    const planDefaults = PLAN_LIMITS[tier] ?? PLAN_LIMITS["starter"];
    const monthlyLimit = business.monthly_token_limit ?? planDefaults.monthlyTokens;

    // 2. Get current month's total tokens from api_usage
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const { data: usageData, error: usageError } = await supabase
      .from("api_usage")
      .select("prompt_tokens, completion_tokens")
      .eq("business_id", businessId)
      .gte("created_at", firstOfMonth.toISOString());

    if (usageError) {
      console.error("Budget check: failed to fetch usage", usageError.message);
      return { allowed: true, warningLevel: "none" };
    }

    const records = usageData ?? [];
    let businessTotalTokens = 0;
    for (const r of records) {
      businessTotalTokens += (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0);
    }

    // 3. Check business-level budget
    let businessUtilization: number | undefined;
    let warningLevel: "none" | "amber" | "red" = "none";

    if (monthlyLimit !== null) {
      businessUtilization = Math.round((businessTotalTokens / monthlyLimit) * 100);

      if (businessTotalTokens >= monthlyLimit) {
        return {
          allowed: false,
          reason: "Monthly token limit reached for business",
          businessUtilization,
          businessTokensUsed: businessTotalTokens,
          businessTokenLimit: monthlyLimit,
          warningLevel: "red",
        };
      }

      if (businessUtilization >= 80) {
        warningLevel = "amber";
      }
    }

    // 4. Check agent-level budget if agentId provided
    let agentUtilization: number | undefined;
    let agentTokensUsed: number | undefined;
    let agentTokenBudgetValue: number | undefined;

    if (agentId) {
      // Get agent's token_budget, falling back to template token_budget via JOIN
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("token_budget, agent_templates(token_budget)")
        .eq("id", agentId)
        .single();

      if (!agentError && agentData) {
        // Supabase belongsTo returns object, but TS infers array -- cast through unknown
        const template = agentData.agent_templates as unknown as { token_budget: number | null } | null;
        const agentBudget = agentData.token_budget ?? template?.token_budget ?? null;

        if (agentBudget !== null) {
          agentTokenBudgetValue = agentBudget;

          // Get agent's monthly usage
          const { data: agentUsage, error: agentUsageError } = await supabase
            .from("api_usage")
            .select("prompt_tokens, completion_tokens")
            .eq("agent_id", agentId)
            .gte("created_at", firstOfMonth.toISOString());

          if (!agentUsageError) {
            let agentTotalTokens = 0;
            for (const r of agentUsage ?? []) {
              agentTotalTokens += (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0);
            }

            agentTokensUsed = agentTotalTokens;
            agentUtilization = Math.round((agentTotalTokens / agentBudget) * 100);

            if (agentTotalTokens >= agentBudget) {
              return {
                allowed: false,
                reason: "Agent token budget exceeded",
                agentUtilization,
                agentTokensUsed: agentTotalTokens,
                agentTokenBudget: agentBudget,
                businessUtilization,
                businessTokensUsed: businessTotalTokens,
                businessTokenLimit: monthlyLimit ?? undefined,
                warningLevel: "red",
              };
            }

            if (agentUtilization >= 80 && warningLevel !== "amber") {
              warningLevel = "amber";
            }
          }
        }
      }
    }

    return {
      allowed: true,
      agentUtilization,
      agentTokensUsed,
      agentTokenBudget: agentTokenBudgetValue,
      businessUtilization,
      businessTokensUsed: businessTotalTokens,
      businessTokenLimit: monthlyLimit ?? undefined,
      warningLevel,
    };
  } catch (err) {
    // Best-effort: budget check failure should NOT block the API call
    console.error(
      "Budget check failed:",
      err instanceof Error ? err.message : "Unknown error",
    );
    return { allowed: true, warningLevel: "none" };
  }
}

// ---------------------------------------------------------------------------
// Budget warning detection
// ---------------------------------------------------------------------------

/**
 * Check if a budget warning should be sent (80% threshold).
 * Returns true only if this is the FIRST time crossing 80% today (to avoid spam).
 *
 * The caller is responsible for creating the audit_log entry and sending the
 * Slack DM / notification after this returns true.
 */
export async function shouldSendBudgetWarning(
  supabase: SupabaseClient,
  businessId: string,
  agentId: string,
): Promise<boolean> {
  try {
    // Check if we already sent a budget_warning audit log today for this agent
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: existing, error } = await supabase
      .from("audit_logs")
      .select("id")
      .eq("business_id", businessId)
      .eq("action", "budget_warning")
      .gte("created_at", todayStart.toISOString())
      .limit(1);

    if (error) {
      console.error("Budget warning check failed:", error.message);
      return false;
    }

    if (existing && existing.length > 0) {
      return false; // Already warned today
    }

    // Check current utilization
    const budget = await checkBudget(supabase, businessId, agentId);
    return budget.warningLevel === "amber" || budget.warningLevel === "red";
  } catch (err) {
    console.error(
      "Budget warning check failed:",
      err instanceof Error ? err.message : "Unknown error",
    );
    return false;
  }
}
