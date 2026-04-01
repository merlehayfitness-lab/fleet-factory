/**
 * OpenClaw gateway client using OpenAI-compatible endpoints.
 *
 * OpenClaw exposes /v1/chat/completions (OpenAI format), /v1/models,
 * and /healthz. Auth via Bearer token in Authorization header.
 */

const GATEWAY_URL =
  process.env.OPENCLAW_HTTP_URL || "http://127.0.0.1:18789";
const AUTH_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || "";
const DEFAULT_MODEL =
  process.env.OPENCLAW_MODEL || "openclaw/default";
const OPENCLAW_SCOPES =
  process.env.OPENCLAW_SCOPES || "operator.write";

/**
 * Send a message to an agent via OpenAI-compatible chat completions.
 * Uses the sessionKey as a system context identifier.
 */
export async function sendMessageToAgent(
  sessionKey: string,
  message: string,
  model?: string,
): Promise<{ response: string; model?: string; tokens?: number }> {
  const url = `${GATEWAY_URL}/v1/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-openclaw-scopes": OPENCLAW_SCOPES,
  };
  if (AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are agent ${sessionKey}. Respond helpfully and concisely.`,
        },
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `OpenClaw gateway returned ${res.status}: ${await res.text()}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { total_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content || "";
  return {
    response: content,
    model: data.model,
    tokens: data.usage?.total_tokens,
  };
}

/**
 * Submit a task to an agent for execution.
 * Routes through chat completions with task-formatted prompt.
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
    const url = `${GATEWAY_URL}/v1/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-openclaw-scopes": OPENCLAW_SCOPES,
    };
    if (AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: `You are agent ${sessionKey}. Execute the following task and provide a structured response.`,
          },
          {
            role: "user",
            content: `Execute task: ${taskPayload.title}\n\nTask ID: ${taskPayload.taskId}\nPayload: ${JSON.stringify(taskPayload.payload)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `Gateway returned ${res.status}: ${text}`,
      };
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Check OpenClaw gateway health via /healthz endpoint.
 */
export async function checkGatewayHealth(): Promise<{
  status: string;
  sessions: number;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${GATEWAY_URL}/healthz`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { status: "error", sessions: 0 };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      status: (data.status as string) || "connected",
      sessions: 0,
    };
  } catch {
    return { status: "unreachable", sessions: 0 };
  }
}

/**
 * Stream chat tokens from an agent via SSE (server-sent events).
 *
 * Uses OpenAI-compatible streaming with stream: true.
 * Falls back to non-streaming HTTP POST if streaming fails.
 */
export function streamChatFromAgent(
  sessionKey: string,
  message: string,
  onToken: (token: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: string) => void,
): () => void {
  let aborted = false;
  const controller = new AbortController();

  (async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-openclaw-scopes": OPENCLAW_SCOPES,
      };
      if (AUTH_TOKEN) {
        headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
      }

      const res = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          stream: true,
          messages: [
            {
              role: "system",
              content: `You are agent ${sessionKey}. Respond helpfully and concisely.`,
            },
            { role: "user", content: message },
          ],
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
              onComplete(fullResponse);
              return;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      if (!aborted && fullResponse) {
        onComplete(fullResponse);
      }
    } catch (err) {
      if (!aborted) {
        console.error(
          `[openclaw-client] Stream error for ${sessionKey}:`,
          err,
        );
        // Fallback to non-streaming HTTP
        fallbackToHttp(sessionKey, message, onComplete, onError);
      }
    }
  })();

  return () => {
    aborted = true;
    controller.abort();
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
