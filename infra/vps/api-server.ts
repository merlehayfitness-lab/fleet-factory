/**
 * Agency Factory VPS API Proxy Server.
 *
 * Express server that receives deployment packages, chat messages,
 * task requests, and health checks from the admin app (Vercel).
 * Routes to OpenClaw gateway for actual agent interaction.
 *
 * Authentication: X-API-Key header on all endpoints except /healthz.
 * WebSocket: /ws/deploy/:id and /ws/chat/:conversationId for streaming.
 */

import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import apiRoutes from "./api-routes.js";
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
    console.warn("[auth] WARNING: API_KEY not set -- rejecting all authenticated requests");
    res.status(500).json({ error: "Server misconfigured: API_KEY not set" });
    return;
  }

  if (!providedKey || providedKey !== API_KEY) {
    res.status(401).json({ error: "Unauthorized: invalid or missing X-API-Key header" });
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
 */
function parseWsPath(
  url: string,
): { type: "deploy"; id: string } | { type: "chat"; conversationId: string; agentId?: string } | null {
  const parsed = new URL(url, "http://localhost");
  const pathname = parsed.pathname;

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
  const apiKey = parsed.searchParams.get("apiKey") || parsed.searchParams.get("token");
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
    route: { type: string; id?: string; conversationId?: string; agentId?: string },
  ) => {
    if (route.type === "deploy") {
      handleDeployWebSocket(ws, route.id!);
    } else if (route.type === "chat") {
      handleChatWebSocket(ws, route.conversationId!, route.agentId);
    }
  },
);

/**
 * Handle deployment progress WebSocket.
 * Streams deployment phase updates to the admin app.
 *
 * TODO: Activate when Claude Code is bootstrapped on VPS
 * When active:
 *   - Subscribe to deployment progress events from the deploy pipeline
 *   - Stream real phase/detail/agent_status/complete/error events
 * For MVP: send a simple connected + complete sequence
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

  // TODO: Subscribe to real deployment progress events
  // For MVP: the deploy endpoint is synchronous, so close after connected

  ws.on("close", () => {
    console.log(`[ws:deploy] Client disconnected from deployment ${deployId}`);
  });

  ws.on("error", (err) => {
    console.error(`[ws:deploy] Error for deployment ${deployId}:`, err.message);
  });
}

/**
 * Handle chat streaming WebSocket.
 * Streams agent response tokens to the admin app in real time.
 *
 * TODO: Activate when Claude Code is bootstrapped on VPS
 * When active:
 *   - Connect to OpenClaw gateway WebSocket for agent session
 *   - Forward token events from agent to admin app client
 *   - Handle agent tool calls and stream summaries
 * For MVP: send a stub token sequence when client sends a message
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

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`[ws:chat] Received message for ${conversationId}:`, msg.message?.slice(0, 50));

      // TODO: Route to OpenClaw agent and stream real tokens
      // For MVP: send stub token events

      const stubTokens = [
        "I ",
        "received ",
        "your ",
        "message. ",
        "[Real-time ",
        "streaming ",
        "will ",
        "activate ",
        "when ",
        "Claude Code ",
        "is ",
        "bootstrapped]",
      ];

      let tokenIndex = 0;
      const tokenInterval = setInterval(() => {
        if (tokenIndex >= stubTokens.length || ws.readyState !== WebSocket.OPEN) {
          clearInterval(tokenInterval);
          if (ws.readyState === WebSocket.OPEN) {
            const completeEvent: ChatStreamEvent = {
              type: "complete",
              content: stubTokens.join(""),
              agentId: agentId || "stub",
              timestamp: new Date().toISOString(),
            };
            ws.send(JSON.stringify(completeEvent));
          }
          return;
        }

        const tokenEvent: ChatStreamEvent = {
          type: "token",
          content: stubTokens[tokenIndex],
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(tokenEvent));
        tokenIndex++;
      }, 50);
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
    console.log(`[ws:chat] Client disconnected from conversation ${conversationId}`);
  });

  ws.on("error", (err) => {
    console.error(`[ws:chat] Error for conversation ${conversationId}:`, err.message);
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
  if (!API_KEY) {
    console.warn("  WARNING: API_KEY is not set -- all authenticated requests will be rejected");
  }
});

export { app, server };
