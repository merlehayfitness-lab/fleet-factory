import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Derive a deterministic vpsAgentId from business/agent metadata.
 * Format: {businessSlug}-{departmentType}-{agentIdPrefix}
 * where agentIdPrefix = first 8 chars of the agent UUID (hyphens stripped).
 *
 * IMPORTANT: This is the single source of truth for the naming convention.
 * Used by:
 *   - packages/runtime/generators/openclaw-config.ts (workspace generation)
 *   - packages/core/orchestrator/executor.ts (VPS task routing)
 *   - infra/vps/api-routes.ts (filesystem paths -- documents same convention)
 */
export function deriveVpsAgentId(
  businessSlug: string,
  departmentType: string,
  agentId: string,
): string {
  const prefix = agentId.replace(/-/g, "").slice(0, 8);
  return `${businessSlug}-${departmentType}-${prefix}`;
}

/**
 * Parse a vpsAgentId back into its components.
 * Format: {businessSlug}-{departmentType}-{agentIdPrefix}
 *
 * The agentIdPrefix is always exactly 8 alphanumeric chars (from UUID).
 * The departmentType is always a single word (no hyphens).
 * The businessSlug can contain hyphens.
 *
 * Returns null if the ID doesn't match the expected format.
 */
export function parseVpsAgentId(vpsAgentId: string): {
  businessSlug: string;
  departmentType: string;
  agentIdPrefix: string;
} | null {
  const parts = vpsAgentId.split("-");
  // Need at least 3 parts: slug (1+), dept (1), prefix (1)
  if (parts.length < 3) return null;

  const agentIdPrefix = parts[parts.length - 1];
  const departmentType = parts[parts.length - 2];
  const businessSlug = parts.slice(0, -2).join("-");

  // Validate prefix is 8 alphanumeric chars
  if (!/^[a-f0-9]{8}$/i.test(agentIdPrefix)) return null;
  if (!businessSlug || !departmentType) return null;

  return { businessSlug, departmentType, agentIdPrefix };
}

/**
 * Look up the vps_agent_id for an agent from the agent_vps_status table.
 * Falls back to deriving the ID from business slug + department type + agent ID prefix.
 *
 * Returns null if the agent has no VPS mapping and derivation data is unavailable.
 */
export async function getVpsAgentId(
  supabase: SupabaseClient,
  agentId: string,
): Promise<string | null> {
  const { data: vpsStatus } = await supabase
    .from("agent_vps_status")
    .select("vps_agent_id")
    .eq("agent_id", agentId)
    .limit(1)
    .single();

  if (vpsStatus?.vps_agent_id) {
    return vpsStatus.vps_agent_id as string;
  }

  // Fallback: derive from business slug + department type + agent ID prefix
  const { data: agent } = await supabase
    .from("agents")
    .select("id, department_id, business_id")
    .eq("id", agentId)
    .single();

  if (!agent) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", agent.business_id as string)
    .single();

  if (!business?.slug) return null;

  const { data: dept } = await supabase
    .from("departments")
    .select("type")
    .eq("id", agent.department_id as string)
    .single();

  if (!dept?.type) return null;

  return deriveVpsAgentId(
    business.slug as string,
    dept.type as string,
    agentId,
  );
}
