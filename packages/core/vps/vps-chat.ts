/**
 * VPS chat routing service.
 *
 * Routes chat messages from the admin app to real VPS agents
 * and retrieves streaming WebSocket URLs for real-time responses.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { vpsPost } from "./vps-client";
import { getVpsConfig } from "./vps-config";
import { deriveVpsAgentId } from "./vps-naming";
import type { VpsChatResponse } from "./vps-types";

/**
 * Look up the vps_agent_id for an agent from the agent_vps_status table.
 * Falls back to deriving the ID from business slug + department type + agent ID prefix.
 *
 * The fallback derivation uses the shared deriveVpsAgentId() to ensure consistency
 * with the openclaw-config.ts generator naming convention.
 *
 * Returns null if the agent has no VPS mapping and derivation data is unavailable.
 */
export async function getVpsAgentId(
  supabase: SupabaseClient,
  agentId: string,
): Promise<string | null> {
  // Try direct lookup from agent_vps_status table
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

  // Get business slug
  const { data: business } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", agent.business_id as string)
    .single();

  if (!business?.slug) return null;

  // Get department type
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

/**
 * Send a chat message to a VPS agent and return its response.
 *
 * POSTs to /api/agents/{vpsAgentId}/chat on the VPS.
 * On error, returns a fallback response indicating the agent is unavailable.
 */
export async function sendChatToVps(
  businessId: string,
  agentId: string,
  vpsAgentId: string,
  conversationId: string,
  message: string,
): Promise<VpsChatResponse> {
  try {
    const result = await vpsPost<VpsChatResponse>(
      `/api/agents/${encodeURIComponent(vpsAgentId)}/chat`,
      {
        businessId,
        agentId,
        vpsAgentId,
        conversationId,
        message,
      },
    );

    if (result.error) {
      return {
        content:
          "Agent is temporarily unavailable. Your message has been saved.",
        agentId,
        toolCalls: [],
      };
    }

    return {
      content: result.content,
      agentId: result.agentId ?? agentId,
      toolCalls: result.toolCalls ?? [],
    };
  } catch {
    return {
      content:
        "Agent is temporarily unavailable. Your message has been saved.",
      agentId,
      toolCalls: [],
    };
  }
}

/**
 * Build a WebSocket URL for streaming chat from a VPS agent.
 *
 * Format: {wsUrl}/chat/{conversationId}?agent={vpsAgentId}&apiKey={key}
 * Used by the client-side chat component for real-time streaming.
 */
export function getVpsChatWsUrl(
  vpsAgentId: string,
  conversationId: string,
): string {
  const config = getVpsConfig();
  return `${config.wsUrl}/chat/${encodeURIComponent(conversationId)}?agent=${encodeURIComponent(vpsAgentId)}&apiKey=${encodeURIComponent(config.apiKey)}`;
}
