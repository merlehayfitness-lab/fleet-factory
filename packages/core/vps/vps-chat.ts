/**
 * VPS chat routing service.
 *
 * Routes messages to VPS agents via the proxy's async submit + poll pattern.
 * Used by the Slack message handler pipeline (via chat-service.ts routeAndRespond).
 */

import { vpsPost, vpsGet } from "./vps-client";
import type {
  VpsChatResponse,
  AsyncChatSubmitResponse,
  AsyncChatPollResponse,
} from "./vps-types";

const SUBMIT_TIMEOUT = 10_000; // 10s — just submitting, should be instant
const POLL_INTERVAL = 3_000; // 3s between polls
const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes max wait
const MAX_OVERLOADED_RETRIES = 2; // Retry up to 2x on Anthropic 529 overloaded errors
const OVERLOADED_RETRY_DELAY = 5_000; // 5s between retries

/** Detect Anthropic overloaded errors returned as response content */
function isOverloadedResponse(content: string): boolean {
  const lower = content.toLowerCase();
  return lower.includes("temporarily overloaded") || lower.includes("overloaded");
}

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
  // Retry wrapper for Anthropic 529 "overloaded" errors
  for (let attempt = 0; attempt <= MAX_OVERLOADED_RETRIES; attempt++) {
    const result = await sendChatToVpsOnce(
      businessId, agentId, vpsAgentId, conversationId, message, knowledgeContext, model,
    );

    // Check if the response is an Anthropic overloaded error surfaced as content
    if (isOverloadedResponse(result.content) && attempt < MAX_OVERLOADED_RETRIES) {
      console.warn(
        `[vps-chat] Anthropic overloaded (attempt ${attempt + 1}/${MAX_OVERLOADED_RETRIES + 1}), retrying in ${OVERLOADED_RETRY_DELAY / 1000}s...`,
      );
      await sleep(OVERLOADED_RETRY_DELAY);
      continue;
    }

    // Strip the overloaded prefix if it was prepended to the real response
    if (result.content.startsWith("The AI service is temporarily overloaded.") && result.content.length > 80) {
      result.content = result.content
        .replace(/^The AI service is temporarily overloaded\.\s*Please try again in a moment\.\s*/i, "")
        .trim();
    }

    return result;
  }

  // All retries exhausted
  return {
    content: "The agent is busy right now. Please try again in a moment.",
    agentId,
    toolCalls: [],
  };
}

/** Single attempt to send chat to VPS (submit + poll). */
async function sendChatToVpsOnce(
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
          tokenUsage: poll.result.tokenUsage ? {
            promptTokens: poll.result.tokenUsage.prompt_tokens,
            completionTokens: poll.result.tokenUsage.completion_tokens,
            totalTokens: poll.result.tokenUsage.total_tokens,
            model: poll.result.tokenUsage.model,
          } : undefined,
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
