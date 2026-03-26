import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskLevel } from "../types/index";

/**
 * Evaluate the risk level for a given action type.
 *
 * Matches the action type against approval_policies using prefix matching.
 * If no policy matches, defaults to 'medium' risk.
 */
export async function evaluateRisk(
  supabase: SupabaseClient,
  actionType: string,
): Promise<{
  riskLevel: RiskLevel;
  policy: Record<string, unknown> | null;
  explanation: string;
}> {
  // Fetch all active policies
  const { data: policies, error } = await supabase
    .from("approval_policies")
    .select("*")
    .eq("is_active", true)
    .order("action_pattern", { ascending: true });

  if (error || !policies) {
    // If we cannot fetch policies, default to medium (cautious)
    return {
      riskLevel: "medium",
      policy: null,
      explanation: "Unable to evaluate policy rules; defaulting to medium risk",
    };
  }

  // Match action type against policy patterns using prefix matching.
  // Policies use SQL LIKE patterns with % wildcard (e.g., 'search_%').
  // We convert to prefix matching: strip trailing % and _ characters.
  for (const policy of policies) {
    const pattern = (policy.action_pattern as string).replace(/[_%]+$/, "");
    if (actionType.startsWith(pattern)) {
      return {
        riskLevel: policy.risk_level as RiskLevel,
        policy: policy as Record<string, unknown>,
        explanation: (policy.description as string) ?? `Matches policy: ${policy.action_pattern}`,
      };
    }
  }

  // No match found -- default to medium risk
  return {
    riskLevel: "medium",
    policy: null,
    explanation: "No matching policy found; defaulting to medium risk",
  };
}

/**
 * Check whether an agent is marked as trusted.
 * Trusted agents can auto-approve medium-risk actions.
 */
export async function checkAgentTrust(
  supabase: SupabaseClient,
  agentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("agents")
    .select("is_trusted")
    .eq("id", agentId)
    .single();

  if (error || !data) {
    return false; // Default to untrusted if lookup fails
  }

  return data.is_trusted === true;
}

/**
 * Determine whether an action should be auto-approved based on risk level and agent trust.
 *
 * Rules:
 * - Low risk: always auto-approve
 * - Medium risk + trusted agent: auto-approve
 * - Medium risk + untrusted agent: needs human review
 * - High risk: always needs human review
 */
export function shouldAutoApprove(
  riskLevel: RiskLevel,
  isTrusted: boolean,
): boolean {
  if (riskLevel === "low") return true;
  if (riskLevel === "medium" && isTrusted) return true;
  return false;
}
