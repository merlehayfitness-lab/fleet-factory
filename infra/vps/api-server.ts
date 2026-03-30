/**
 * Agency Factory VPS API Proxy Server.
 *
 * Express server that receives deployment packages, chat messages,
 * task requests, and health checks from the admin app (Vercel).
 * Routes to OpenClaw gateway for actual agent interaction.
 *
 * Authentication: X-API-Key header on all endpoints except /healthz.
 * WebSocket: /ws/deploy/:id, /ws/chat/:conversationId, and /ws/terminal/:businessSlug for streaming.
 */

import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import apiRoutes, { deployEvents } from "./api-routes.js";
import { streamChatFromAgent } from "./openclaw-client.js";
import { loadDeploymentState } from "./deploy-state.js";
import type { DeployProgressEvent, ChatStreamEvent } from "./api-types.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3100", 10);
const API_KEY = process.env.API_KEY || "";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// JSON body parser with 10MB limit for workspace files
app.use(express.json({ limit: "10mb" }));

// CORS headers for admin app domain
app.use((_req, res, next) => {
  // Allow any origin in development; restrict in production
  const allowedOrigin = process.env.ADMIN_APP_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// API key auth middleware -- skip for /healthz liveness probe
app.use((req, res, next) => {
  if (req.path === "/healthz") {
    next();
    return;
  }

  const providedKey = req.headers["x-api-key"];

  if (!API_KEY) {
    console.warn(
      "[auth] WARNING: API_KEY not set -- rejecting all authenticated requests",
    );
    res.status(500).json({ error: "Server misconfigured: API_KEY not set" });
    return;
  }

  if (!providedKey || providedKey !== API_KEY) {
    res
      .status(401)
      .json({ error: "Unauthorized: invalid or missing X-API-Key header" });
    return;
  }

  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use(apiRoutes);

// ---------------------------------------------------------------------------
// HTTP + WebSocket Server
// ---------------------------------------------------------------------------

const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

/**
 * Parse WebSocket path and validate auth token.
 * Supported paths:
 *   /ws/deploy/:id
 *   /ws/chat/:conversationId  (also accepts /chat/:conversationId)
 *   /ws/terminal/:businessSlug
 */
function parseWsPath(
  url: string,
):
  | { type: "deploy"; id: string }
  | { type: "chat"; conversationId: string; agentId?: string }
  | { type: "terminal"; businessSlug: string }
  | null {
  const parsed = new URL(url, "http://localhost");
  const pathname = parsed.pathname;

  // Terminal streaming: /ws/terminal/:businessSlug
  const termMatch = pathname.match(/^\/ws\/terminal\/(.+)$/);
  if (termMatch) {
    return { type: "terminal", businessSlug: termMatch[1] };
  }

  // Deploy streaming: /ws/deploy/:id
  const deployMatch = pathname.match(/^\/ws\/deploy\/(.+)$/);
  if (deployMatch) {
    return { type: "deploy", id: deployMatch[1] };
  }

  // Chat streaming: /ws/chat/:conversationId or /chat/:conversationId
  const chatMatch = pathname.match(/^(?:\/ws)?\/chat\/(.+)$/);
  if (chatMatch) {
    const agentId = parsed.searchParams.get("agent") || undefined;
    return { type: "chat", conversationId: chatMatch[1], agentId };
  }

  return null;
}

function validateWsAuth(url: string): boolean {
  const parsed = new URL(url, "http://localhost");
  const apiKey =
    parsed.searchParams.get("apiKey") || parsed.searchParams.get("token");
  return apiKey === API_KEY;
}

server.on("upgrade", (request: IncomingMessage, socket, head) => {
  const url = request.url || "/";

  // Validate auth
  if (!validateWsAuth(url)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const route = parseWsPath(url);
  if (!route) {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, route);
  });
});

wss.on(
  "connection",
  (
    ws: WebSocket,
    _request: IncomingMessage,
    route: {
      type: string;
      id?: string;
      conversationId?: string;
      agentId?: string;
      businessSlug?: string;
    },
  ) => {
    if (route.type === "deploy") {
      handleDeployWebSocket(ws, route.id!);
    } else if (route.type === "chat") {
      handleChatWebSocket(ws, route.conversationId!, route.agentId);
    } else if (route.type === "terminal") {
      // Terminal handling will be wired in Plan 02
      ws.send("Terminal support loading...\r\n");
    }
  },
);

/**
 * Handle deployment progress WebSocket.
 * Subscribes to deployEvents EventEmitter and streams real progress to client.
 * If deployment already completed, sends the final status immediately.
 */
function handleDeployWebSocket(ws: WebSocket, deployId: string): void {
  console.log(`[ws:deploy] Client connected for deployment ${deployId}`);

  // Send initial connected event
  const connectedEvent: DeployProgressEvent = {
    type: "phase",
    phase: "connected",
    message: `Connected to deployment ${deployId} progress stream`,
    timestamp: new Date().toISOString(),
  };
  ws.send(JSON.stringify(connectedEvent));

  // Check if deployment already completed
  const existingState = loadDeploymentState(deployId);
  if (
    existingState &&
    (existingState.status === "completed" ||
      existingState.status === "failed" ||
      existingState.status === "cancelled")
  ) {
    const finalEvent: DeployProgressEvent = {
      type: "complete",
      phase: existingState.status,
      message: `Deployment ${existingState.status}`,
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(finalEvent));
    return;
  }

  // Subscribe to real deploy progress events
  const handler = (event: DeployProgressEvent) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  };
  deployEvents.on(deployId, handler);

  ws.on("close", () => {
    deployEvents.removeListener(deployId, handler);
    console.log(`[ws:deploy] Client disconnected from deployment ${deployId}`);
  });

  ws.on("error", (err) => {
    deployEvents.removeListener(deployId, handler);
    console.error(
      `[ws:deploy] Error for deployment ${deployId}:`,
      err.message,
    );
  });
}

/**
 * Handle chat streaming WebSocket.
 * Bridges client WebSocket to OpenClaw gateway WebSocket for real token streaming.
 */
function handleChatWebSocket(
  ws: WebSocket,
  conversationId: string,
  agentId?: string,
): void {
  console.log(
    `[ws:chat] Client connected for conversation ${conversationId}` +
      (agentId ? ` (agent: ${agentId})` : ""),
  );

  let cleanupStream: (() => void) | null = null;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as {
        message?: string;
        agentId?: string;
      };
      console.log(
        `[ws:chat] Received message for ${conversationId}:`,
        msg.message?.slice(0, 50),
      );

      // Clean up previous stream if any
      if (cleanupStream) {
        cleanupStream();
        cleanupStream = null;
      }

      const targetAgent = msg.agentId || agentId || conversationId;

      // Stream real tokens from OpenClaw gateway
      cleanupStream = streamChatFromAgent(
        targetAgent,
        msg.message || "",
        // onToken
        (token: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            const tokenEvent: ChatStreamEvent = {
              type: "token",
              content: token,
              timestamp: new Date().toISOString(),
            };
            ws.send(JSON.stringify(tokenEvent));
          }
        },
        // onComplete
        (fullResponse: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            const completeEvent: ChatStreamEvent = {
              type: "complete",
              content: fullResponse,
              agentId: targetAgent,
              timestamp: new Date().toISOString(),
            };
            ws.send(JSON.stringify(completeEvent));
          }
        },
        // onError
        (error: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            const errorEvent: ChatStreamEvent = {
              type: "error",
              error,
              timestamp: new Date().toISOString(),
            };
            ws.send(JSON.stringify(errorEvent));
          }
        },
      );
    } catch {
      const errorEvent: ChatStreamEvent = {
        type: "error",
        error: "Failed to parse message",
        timestamp: new Date().toISOString(),
      };
      ws.send(JSON.stringify(errorEvent));
    }
  });

  ws.on("close", () => {
    if (cleanupStream) {
      cleanupStream();
      cleanupStream = null;
    }
    console.log(
      `[ws:chat] Client disconnected from conversation ${conversationId}`,
    );
  });

  ws.on("error", (err) => {
    if (cleanupStream) {
      cleanupStream();
      cleanupStream = null;
    }
    console.error(
      `[ws:chat] Error for conversation ${conversationId}:`,
      err.message,
    );
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`Agency Factory VPS Proxy listening on port ${PORT}`);
  console.log(`  API routes: http://0.0.0.0:${PORT}/api/*`);
  console.log(`  WebSocket:  ws://0.0.0.0:${PORT}/ws/*`);
  console.log(`  Health:     http://0.0.0.0:${PORT}/healthz`);
  console.log(`  Tenant dir: ${process.env.TENANT_DATA_DIR || "/data/tenants"}`);
  console.log(
    `  State dir:  ${process.env.STATE_DIR || "/data/state"}`,
  );
  if (!API_KEY) {
    console.warn(
      "  WARNING: API_KEY is not set -- all authenticated requests will be rejected",
    );
  }
});

export { app, server };
