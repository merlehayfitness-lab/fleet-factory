/**
 * VPS chat routing service.
 *
 * Routes chat messages from the admin app to real VPS agents
 * and retrieves streaming WebSocket URLs for real-time responses.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { vpsPost, vpsGet } from "./vps-client";
import { getVpsConfig } from "./vps-config";
import { deriveVpsAgentId } from "./vps-naming";
import type {
  VpsChatResponse,
  AsyncChatSubmitResponse,
  AsyncChatPollResponse,
} from "./vps-types";

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

const SUBMIT_TIMEOUT = 10_000; // 10s — just submitting, should be instant
const POLL_INTERVAL = 3_000; // 3s between polls
const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes max wait

/**
 * Send a chat message to a VPS agent and return its response.
 *
 * Uses an async submit + poll pattern:
 * 1. POST to /api/agents/{vpsAgentId}/chat — returns { requestId } immediately
 * 2. Poll GET /api/chat-results/{requestId} every 3s until complete (max 5 min)
 *
 * This eliminates timeouts for complex multi-step Claude responses.
 */
export async function sendChatToVps(
  businessId: string,
  agentId: string,
  vpsAgentId: string,
  conversationId: string,
  message: string,
  knowledgeContext?: string,
  model?: string,
): Promise<VpsChatResponse> {
  const payload: Record<string, unknown> = {
    businessId,
    agentId,
    vpsAgentId,
    conversationId,
    message,
  };
  if (knowledgeContext) {
    payload.knowledgeContext = knowledgeContext;
  }
  if (model) {
    payload.model = model;
  }

  const chatPath = `/api/agents/${encodeURIComponent(vpsAgentId)}/chat`;

  // Step 1: Submit the chat request (returns immediately with requestId)
  let requestId: string;
  try {
    const submitResult = await vpsPost<AsyncChatSubmitResponse>(
      chatPath,
      payload,
      SUBMIT_TIMEOUT,
    );

    if (submitResult.error || !submitResult.requestId) {
      console.error(
        `[vps-chat] Submit failed for ${vpsAgentId}: ${submitResult.error ?? "no requestId"}`,
      );
      return {
        content:
          "Agent is temporarily unavailable. Your message has been saved.",
        agentId,
        toolCalls: [],
      };
    }

    requestId = submitResult.requestId;
    console.log(
      `[vps-chat] Async chat ${requestId} submitted for ${vpsAgentId}`,
    );
  } catch (err) {
    console.error(
      `[vps-chat] Submit exception for ${vpsAgentId}:`,
      err,
    );
    return {
      content:
        "Agent is temporarily unavailable. Your message has been saved.",
      agentId,
      toolCalls: [],
    };
  }

  // Step 2: Poll for results
  const pollPath = `/api/chat-results/${encodeURIComponent(requestId)}`;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME) {
    await sleep(POLL_INTERVAL);

    try {
      const poll = await vpsGet<AsyncChatPollResponse>(pollPath);

      if (poll.error && !poll.status) {
        // 404 or network error — VPS may have restarted
        console.error(
          `[vps-chat] Poll error for ${requestId}: ${poll.error}`,
        );
        return {
          content:
            "Agent connection was interrupted. Your message has been saved — please try again.",
          agentId,
          toolCalls: [],
        };
      }

      if (poll.status === "complete" && poll.result) {
        console.log(
          `[vps-chat] Async chat ${requestId} complete after ${Math.round((Date.now() - startTime) / 1000)}s`,
        );
        return {
          content: poll.result.content,
          agentId: poll.result.agentId ?? agentId,
          toolCalls: poll.result.toolCalls ?? [],
        };
      }

      if (poll.status === "failed") {
        console.error(
          `[vps-chat] Async chat ${requestId} failed: ${poll.error}`,
        );
        return {
          content:
            "Agent encountered an error processing your request. Please try again.",
          agentId,
          toolCalls: [],
        };
      }

      // Still processing — continue polling
    } catch (err) {
      console.error(
        `[vps-chat] Poll exception for ${requestId}:`,
        err,
      );
      // Network blip — keep polling, don't give up immediately
    }
  }

  // Max poll time exceeded
  console.warn(
    `[vps-chat] Async chat ${requestId} exceeded max poll time (${MAX_POLL_TIME / 1000}s)`,
  );
  return {
    content:
      "The agent is still working on your request. Please check back in a moment.",
    agentId,
    toolCalls: [],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
