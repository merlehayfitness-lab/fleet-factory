/**
 * OpenClaw gateway client — per-agent container routing.
 *
 * Each agent runs its own OpenClaw instance in a Docker container on a unique port.
 * This client resolves the correct gateway URL for each agent via the port registry.
 *
 * Agent identity and behavior are defined by workspace files (IDENTITY.md,
 * SOUL.md, AGENTS.md, TOOLS.md) — NOT by hardcoded system prompts here.
 */

import { getPort, loadPortRegistry, getAllPorts } from "./port-registry.js";

// Load port registry on module init
loadPortRegistry();

const AUTH_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || "";
const DEFAULT_MODEL = process.env.OPENCLAW_MODEL || "openclaw/default";
const OPENCLAW_SCOPES = process.env.OPENCLAW_SCOPES || "operator.write";

/** Timeout for chat/task completions (2 minutes) */
const CHAT_TIMEOUT_MS = 120_000;

/**
 * Lightweight system rules applied to all agents.
 * Agent-specific identity comes from workspace files, not here.
 */
const UNIVERSAL_RULES = `## Critical Rules

1. **Never fabricate actions or results.** Do not pretend to search, query, or fetch data you cannot actually access. If a tool call fails, report the failure honestly.
2. **Be honest about your capabilities.** If you cannot do something, say so clearly. Explain what you CAN help with and what requires integration that isn't set up yet.
3. **Never invent data.** Do not make up lead lists, search results, metrics, or any other data. If you don't have real data, say so.

## Task Handling

For complex or multi-step requests:
1. Reply with a brief plan: what you'll do, what you need, and what the deliverable will look like
2. Ask the user to confirm before proceeding
3. When confirmed, execute what you can and be clear about what still needs manual steps

For simple questions or conversational messages: respond directly.`;

/** Options for sending messages to agents */
interface SendMessageOptions {
  knowledgeContext?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Resolve the gateway URL for a specific agent's container.
 * Each container exposes OpenClaw on a unique host port.
 */
function getAgentGatewayUrl(vpsAgentId: string): string {
  const port = getPort(vpsAgentId);
  if (!port) {
    // Fallback: try reloading registry in case of recent deploy
    loadPortRegistry();
    const retryPort = getPort(vpsAgentId);
    if (!retryPort) {
      throw new Error(`No container port for agent ${vpsAgentId}. Agent may not be deployed.`);
    }
    return `http://127.0.0.1:${retryPort}`;
  }
  return `http://127.0.0.1:${port}`;
}

/**
 * Build common headers for OpenClaw requests.
 * Includes agent targeting and session persistence headers.
 */
function buildHeaders(
  vpsAgentId: string,
  conversationId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-openclaw-scopes": OPENCLAW_SCOPES,
    "x-openclaw-agent-id": vpsAgentId,
  };
  if (conversationId) {
    headers["x-openclaw-session-key"] = conversationId;
  }
  if (AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

/**
 * Build messages array for a chat request.
 */
function buildMessages(
  message: string,
  options?: SendMessageOptions & { taskPreamble?: string },
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  let systemContent = UNIVERSAL_RULES;
  if (options?.taskPreamble) {
    systemContent = `${options.taskPreamble}\n\n${systemContent}`;
  }
  if (options?.knowledgeContext) {
    systemContent = `## Relevant Context\n\n${options.knowledgeContext}\n\n${systemContent}`;
  }
  messages.push({ role: "system", content: systemContent });
  messages.push({ role: "user", content: message });
  return messages;
}

/**
 * Create an AbortController with a timeout.
 */
function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    cleanup: () => clearTimeout(timer),
  };
}

/**
 * Send a message to a specific agent via its container's OpenClaw gateway.
 */
export async function sendMessageToAgent(
  vpsAgentId: string,
  message: string,
  conversationId?: string,
  options?: SendMessageOptions,
): Promise<{
  response: string;
  model?: string;
  tokens?: number;
  tokenUsage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  const gatewayUrl = getAgentGatewayUrl(vpsAgentId);
  const url = `${gatewayUrl}/v1/chat/completions`;
  const headers = buildHeaders(vpsAgentId, conversationId);
  const { controller, cleanup } = createTimeoutController(
    options?.timeoutMs ?? CHAT_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: options?.model || DEFAULT_MODEL,
        messages: buildMessages(message, options),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(
        `OpenClaw gateway returned ${res.status}: ${await res.text()}`,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content || "";
    return {
      response: content,
      model: data.model,
      tokens: data.usage?.total_tokens,
      tokenUsage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens ?? 0,
        completion_tokens: data.usage.completion_tokens ?? 0,
        total_tokens: data.usage.total_tokens ?? 0,
      } : undefined,
    };
  } finally {
    cleanup();
  }
}

/**
 * Submit a task to a specific agent for execution.
 */
export async function submitTaskToAgent(
  vpsAgentId: string,
  taskPayload: {
    taskId: string;
    title: string;
    payload: Record<string, unknown>;
  },
  conversationId?: string,
  options?: SendMessageOptions,
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  toolsUsed?: string[];
  tokenUsage?: { prompt_tokens: number; completion_tokens: number };
  error?: string;
}> {
  try {
    const gatewayUrl = getAgentGatewayUrl(vpsAgentId);
    const url = `${gatewayUrl}/v1/chat/completions`;
    const headers = buildHeaders(vpsAgentId, conversationId);
    const { controller, cleanup } = createTimeoutController(
      options?.timeoutMs ?? CHAT_TIMEOUT_MS,
    );

    const taskMessage = `Execute task: ${taskPayload.title}\n\nTask ID: ${taskPayload.taskId}\nPayload: ${JSON.stringify(taskPayload.payload)}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: options?.model || DEFAULT_MODEL,
          messages: buildMessages(taskMessage, {
            ...options,
            taskPreamble: "Execute the following task and provide a structured response.",
          }),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Gateway returned ${res.status}: ${text}` };
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content || "";
      return {
        success: true,
        result: { response: content },
        toolsUsed: [],
        tokenUsage: data.usage as
          | { prompt_tokens: number; completion_tokens: number }
          | undefined,
      };
    } finally {
      cleanup();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Check health of a specific agent's container via its OpenClaw /healthz endpoint.
 */
export async function checkAgentContainerHealth(vpsAgentId: string): Promise<{
  status: "healthy" | "unhealthy" | "not_deployed";
  port?: number;
}> {
  const port = getPort(vpsAgentId);
  if (!port) {
    return { status: "not_deployed" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return { status: res.ok ? "healthy" : "unhealthy", port };
  } catch {
    return { status: "unhealthy", port };
  }
}

/**
 * Check overall gateway health by checking all deployed containers.
 * Returns aggregate status for backward compatibility.
 */
export async function checkGatewayHealth(): Promise<{
  status: string;
  sessions: number;
}> {
  const ports = getAllPorts();
  const portEntries = Object.values(ports);

  if (portEntries.length === 0) {
    return { status: "no_agents", sessions: 0 };
  }

  // Spot-check the first agent's health
  const firstAgent = Object.keys(ports)[0];
  const health = await checkAgentContainerHealth(firstAgent);

  return {
    status: health.status === "healthy" ? "connected" : "degraded",
    sessions: portEntries.length,
  };
}

/**
 * Stream chat tokens from an agent via SSE (server-sent events).
 * Falls back to non-streaming HTTP POST if streaming fails.
 */
export function streamChatFromAgent(
  vpsAgentId: string,
  message: string,
  onToken: (token: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void,
  conversationId?: string,
  options?: SendMessageOptions,
): () => void {
  let aborted = false;
  const controller = new AbortController();
  const streamTimer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

  (async () => {
    try {
      const gatewayUrl = getAgentGatewayUrl(vpsAgentId);
      const headers = buildHeaders(vpsAgentId, conversationId);

      const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: options?.model || DEFAULT_MODEL,
          stream: true,
          messages: buildMessages(message, options),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Stream request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            clearTimeout(streamTimer);
            onComplete(fullResponse);
            return;
          }
          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
            };
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              onToken(content);
            }
            if (chunk.choices?.[0]?.finish_reason === "stop") {
              clearTimeout(streamTimer);
              onComplete(fullResponse);
              return;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      clearTimeout(streamTimer);
      if (!aborted && fullResponse) {
        onComplete(fullResponse);
      }
    } catch (err) {
      clearTimeout(streamTimer);
      if (!aborted) {
        console.error(
          `[openclaw-client] Stream error for ${vpsAgentId}:`,
          err,
        );
        fallbackToHttp(vpsAgentId, message, onComplete, onError, conversationId, options);
      }
    }
  })();

  return () => {
    aborted = true;
    clearTimeout(streamTimer);
    controller.abort();
  };
}

/**
 * Fallback: send message via HTTP and call onComplete with full response.
 */
async function fallbackToHttp(
  vpsAgentId: string,
  message: string,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void,
  conversationId?: string,
  options?: SendMessageOptions,
): Promise<void> {
  try {
    const result = await sendMessageToAgent(vpsAgentId, message, conversationId, options);
    onComplete(result.response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onError(msg);
  }
}
