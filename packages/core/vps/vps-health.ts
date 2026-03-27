import type { SupabaseClient } from "@supabase/supabase-js";
import { vpsGet } from "./vps-client";
import { isVpsConfigured } from "./vps-config";
import type { VpsHealthStatus, VpsAgentHealthStatus } from "./vps-types";

/**
 * Check VPS health by calling GET /api/health on the VPS.
 * If VPS is not configured, returns { status: "unknown" } with a message.
 * If VPS is unreachable, returns { status: "offline" }.
 */
export async function checkVpsHealth(): Promise<
  VpsHealthStatus | { status: "unknown"; timestamp: string; agentCount: 0; details: { message: string } }
> {
  if (!isVpsConfigured()) {
    return {
      status: "unknown" as const,
      timestamp: new Date().toISOString(),
      agentCount: 0,
      details: { message: "VPS is not configured. Set VPS_API_URL and VPS_API_KEY environment variables." },
    };
  }

  const result = await vpsGet<VpsHealthStatus>("/api/health");

  if (result.error) {
    return {
      status: "offline" as const,
      timestamp: new Date().toISOString(),
      agentCount: 0,
      details: { error: result.error },
    };
  }

  return result;
}

/**
 * Check health of a specific agent on the VPS.
 */
export async function checkAgentHealth(
  vpsAgentId: string,
): Promise<VpsAgentHealthStatus | { vpsAgentId: string; status: "error"; metadata: { error: string } }> {
  const result = await vpsGet<VpsAgentHealthStatus>(
    `/api/agents/${encodeURIComponent(vpsAgentId)}/health`,
  );

  if (result.error) {
    return {
      vpsAgentId,
      status: "error" as const,
      metadata: { error: result.error },
    };
  }

  return result;
}

/**
 * Upsert the singleton vps_status row in the database.
 * Updates status, last_checked_at, and details.
 */
export async function updateVpsStatus(
  supabase: SupabaseClient,
  healthStatus: { status: string; details?: Record<string, unknown> },
): Promise<void> {
  // Try to update the existing singleton row
  const { data: existing } = await supabase
    .from("vps_status")
    .select("id")
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from("vps_status")
      .update({
        status: healthStatus.status,
        last_checked_at: new Date().toISOString(),
        details: healthStatus.details || {},
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("vps_status").insert({
      status: healthStatus.status,
      last_checked_at: new Date().toISOString(),
      details: healthStatus.details || {},
    });
  }
}

/**
 * Upsert agent_vps_status row for a specific agent.
 */
export async function updateAgentVpsStatus(
  supabase: SupabaseClient,
  businessId: string,
  agentId: string,
  vpsAgentId: string,
  containerStatus: string,
): Promise<void> {
  // Check if row exists for this agent
  const { data: existing } = await supabase
    .from("agent_vps_status")
    .select("id")
    .eq("agent_id", agentId)
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from("agent_vps_status")
      .update({
        container_status: containerStatus,
        last_health_check_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("agent_vps_status").insert({
      agent_id: agentId,
      business_id: businessId,
      vps_agent_id: vpsAgentId,
      container_status: containerStatus,
      last_health_check_at: new Date().toISOString(),
    });
  }
}

/**
 * Read current VPS status from the database.
 * Returns the singleton vps_status row.
 */
export async function getVpsStatus(
  supabase: SupabaseClient,
): Promise<{
  id: string;
  status: string;
  last_checked_at: string;
  details: Record<string, unknown>;
  created_at: string;
} | null> {
  const { data } = await supabase
    .from("vps_status")
    .select("*")
    .limit(1)
    .single();

  return data;
}
