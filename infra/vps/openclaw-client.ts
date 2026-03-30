/**
 * OpenClaw gateway HTTP and WebSocket client for agent interaction.
 *
 * Wraps OpenClaw gateway API: sendMessageToAgent, submitTaskToAgent,
 * checkGatewayHealth with Bearer token auth. Provides streamChatFromAgent
 * for real-time WebSocket token streaming.
 */

import { WebSocket } from "ws";

const GATEWAY_URL =
  process.env.OPENCLAW_HTTP_URL || "http://127.0.0.1:18789";
const GATEWAY_WS_URL =
  process.env.OPENCLAW_WS_URL || "ws://127.0.0.1:18789";
const AUTH_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || "";

/**
 * Send a message to an agent via HTTP POST.
 * Returns the agent's response.
 */
export async function sendMessageToAgent(
  sessionKey: string,
  message: string,
): Promise<{ response: string; model?: string; tokens?: number }> {
  const url = `${GATEWAY_URL}/api/sessions/${sessionKey}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    throw new Error(
      `OpenClaw gateway returned ${res.status}: ${await res.text()}`,
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  return {
    response:
      (data.content as string) || (data.response as string) || "",
    model: data.model as string | undefined,
    tokens: (data.usage as Record<string, number> | undefined)
      ?.total_tokens,
  };
}

/**
 * Submit a task to an agent for execution.
 * Returns structured task result.
 */
export async function submitTaskToAgent(
  sessionKey: string,
  taskPayload: {
    taskId: string;
    title: string;
    payload: Record<string, unknown>;
  },
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  toolsUsed?: string[];
  tokenUsage?: { prompt_tokens: number; completion_tokens: number };
  error?: string;
}> {
  try {
    const url = `${GATEWAY_URL}/api/sessions/${sessionKey}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        message: `Execute task: ${taskPayload.title}\n\nPayload: ${JSON.stringify(taskPayload.payload)}`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `Gateway returned ${res.status}: ${text}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      success: true,
      result: {
        response:
          (data.content as string) || (data.response as string) || "",
      },
      toolsUsed: (data.tools_used as string[]) || [],
      tokenUsage: (data.usage as {
        prompt_tokens: number;
        completion_tokens: number;
      }) || undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Check OpenClaw gateway health.
 * Returns status and session count, or unreachable on failure.
 */
export async function checkGatewayHealth(): Promise<{
  status: string;
  sessions: number;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${GATEWAY_URL}/api/status`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { status: "error", sessions: 0 };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      status: (data.status as string) || "connected",
      sessions: (data.sessions as number) || 0,
    };
  } catch {
    return { status: "unreachable", sessions: 0 };
  }
}

/**
 * Stream chat tokens from an agent via WebSocket.
 *
 * Returns a cleanup function to close the connection.
 * Falls back to HTTP POST if WebSocket connection fails.
 */
export function streamChatFromAgent(
  sessionKey: string,
  message: string,
  onToken: (token: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void,
): () => void {
  let closed = false;
  let ws: WebSocket | null = null;

  try {
    ws = new WebSocket(
      `${GATEWAY_WS_URL}/api/sessions/${sessionKey}/stream?token=${AUTH_TOKEN}`,
    );

    ws.on("open", () => {
      ws!.send(JSON.stringify({ message }));
    });

    ws.on("message", (rawData) => {
      try {
        const event = JSON.parse(rawData.toString()) as {
          type: string;
          content?: string;
        };
        if (event.type === "token" && event.content) {
          onToken(event.content);
        } else if (event.type === "complete" && event.content) {
          onComplete(event.content);
        } else if (event.type === "error") {
          onError(event.content || "Unknown streaming error");
        }
      } catch {
        // Non-JSON message, ignore
      }
    });

    ws.on("error", (err) => {
      if (!closed) {
        console.error(
          `[openclaw-client] WebSocket error for ${sessionKey}:`,
          err.message,
        );
        // Fallback to HTTP
        fallbackToHttp(sessionKey, message, onComplete, onError);
      }
    });

    ws.on("close", () => {
      closed = true;
    });
  } catch {
    // WebSocket connection failed, fall back to HTTP
    fallbackToHttp(sessionKey, message, onComplete, onError);
  }

  return () => {
    closed = true;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };
}

/**
 * Fallback: send message via HTTP and call onComplete with full response.
 */
async function fallbackToHttp(
  sessionKey: string,
  message: string,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    const result = await sendMessageToAgent(sessionKey, message);
    onComplete(result.response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onError(msg);
  }
}
