/**
 * VPS API proxy route handlers.
 *
 * Handles chat messages, task execution, health checks, and tenant lifecycle.
 * Each agent runs in its own Docker container with OpenClaw.
 * Deployment is now SSH-only (no /api/deploy endpoint needed).
 */

import { Router } from "express";
import { EventEmitter } from "node:events";
import type {
  ChatRequest,
  ChatResponse,
  AsyncChatState,
  TaskRequest,
  TaskResult,
  HealthStatus,
  AgentHealthStatus,
  TenantLifecycleRequest,
} from "./api-types.js";
import {
  loadAllDeploymentStates,
  loadDeploymentState,
  saveDeploymentState,
} from "./deploy-state.js";
import {
  sendMessageToAgent,
  submitTaskToAgent,
  checkGatewayHealth,
  checkAgentContainerHealth,
} from "./openclaw-client.js";
import {
  getAllPorts,
  getBusinessPorts,
  getPort,
  loadPortRegistry,
  releaseBusinessPorts,
} from "./port-registry.js";
import {
  listTenantContainers,
  stopTenantContainers,
  resumeTenantContainers,
  countRunningAgents,
} from "./container-manager.js";

const router = Router();

// ---------------------------------------------------------------------------
// Shared deploy event emitter for WebSocket streaming
// ---------------------------------------------------------------------------

export const deployEvents = new EventEmitter();

// ---------------------------------------------------------------------------
// Persistent deployment state (hydrated from disk on startup)
// ---------------------------------------------------------------------------

const deployments = loadAllDeploymentStates();
if (deployments.size > 0) {
  console.log(
    `[deploy-state] Recovered ${deployments.size} deployment(s) from disk`,
  );
}

// ---------------------------------------------------------------------------
// Pending async chat results (in-memory, auto-cleaned after 10 min)
// ---------------------------------------------------------------------------

const pendingChats = new Map<string, AsyncChatState>();
const CHAT_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, state] of pendingChats) {
    if (now - state.createdAt > CHAT_TTL_MS) {
      pendingChats.delete(id);
    }
  }
}, 2 * 60 * 1000);

// ---------------------------------------------------------------------------
// GET /api/deploy/:id/status (kept for backward compat with web app)
// ---------------------------------------------------------------------------

router.get("/api/deploy/:id/status", (req, res) => {
  const { id } = req.params;
  const state = deployments.get(id) ?? loadDeploymentState(id);

  if (!state) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  res.json({
    deployId: state.deployId,
    status: state.status,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    result: state.result,
  });
});

// ---------------------------------------------------------------------------
// POST /api/agents/:vpsAgentId/chat (async — returns immediately)
// ---------------------------------------------------------------------------

router.post("/api/agents/:vpsAgentId/chat", (req, res) => {
  try {
    const { vpsAgentId } = req.params;
    const chatReq = req.body as ChatRequest;

    if (!chatReq.businessId) {
      res.status(400).json({ error: "businessId is required" });
      return;
    }
    if (!chatReq.message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    pendingChats.set(requestId, {
      requestId,
      status: "processing",
      createdAt: Date.now(),
    });

    res.json({ requestId, status: "processing" });

    console.log(`[chat] Async request ${requestId} submitted for agent ${vpsAgentId}`);

    sendMessageToAgent(vpsAgentId, chatReq.message, chatReq.conversationId, {
      knowledgeContext: chatReq.knowledgeContext,
      model: chatReq.model,
    })
      .then((result) => {
        const state = pendingChats.get(requestId);
        if (state) {
          state.status = "complete";
          state.result = {
            content: result.response,
            agentId: chatReq.agentId || vpsAgentId,
            toolCalls: [],
            tokenUsage: result.tokenUsage ?? null,
          };
          console.log(
            `[chat] Async request ${requestId} complete for agent ${vpsAgentId} (${result.response.length} chars)`,
          );
        }
      })
      .catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        const state = pendingChats.get(requestId);
        if (state) {
          state.status = "failed";
          state.error = errMsg;
          console.error(
            `[chat] Async request ${requestId} failed for agent ${vpsAgentId}: ${errMsg}`,
          );
        }
      });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[chat] Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/chat-results/:requestId (poll for async chat result)
// ---------------------------------------------------------------------------

router.get("/api/chat-results/:requestId", (req, res) => {
  const { requestId } = req.params;
  const state = pendingChats.get(requestId);

  if (!state) {
    res.status(404).json({ error: "Chat request not found or expired" });
    return;
  }

  res.json({
    requestId: state.requestId,
    status: state.status,
    result: state.result,
    error: state.error,
  });
});

// ---------------------------------------------------------------------------
// POST /api/agents/:vpsAgentId/task
// ---------------------------------------------------------------------------

router.post("/api/agents/:vpsAgentId/task", async (req, res) => {
  try {
    const { vpsAgentId } = req.params;
    const taskReq = req.body as TaskRequest;

    if (!taskReq.businessId) {
      res.status(400).json({ error: "businessId is required" });
      return;
    }
    if (!taskReq.taskId) {
      res.status(400).json({ error: "taskId is required" });
      return;
    }

    const result = await submitTaskToAgent(vpsAgentId, {
      taskId: taskReq.taskId,
      title: taskReq.title,
      payload: taskReq.payload,
    });

    const taskResult: TaskResult = {
      taskId: taskReq.taskId,
      success: result.success,
      result: result.result,
      toolsUsed: result.toolsUsed,
      tokenUsage: result.tokenUsage,
      error: result.error,
    };

    console.log(`[task] Task ${taskReq.taskId} submitted to agent ${vpsAgentId}`);
    res.json(taskResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[task] Error: ${message}`);
    res.status(500).json({ taskId: "", success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/health — Docker-aware health check
// ---------------------------------------------------------------------------

router.get("/api/health", async (_req, res) => {
  try {
    let runningCount = 0;
    try {
      runningCount = await countRunningAgents();
    } catch {
      // Docker not available — count from port registry
      runningCount = Object.keys(getAllPorts()).length;
    }

    const gateway = await checkGatewayHealth();

    const status: HealthStatus = {
      status: runningCount > 0 ? "online" : "degraded",
      timestamp: new Date().toISOString(),
      agentCount: runningCount,
      details: {
        proxy: "running",
        gateway: gateway.status,
        containerCount: runningCount,
        portAllocations: Object.keys(getAllPorts()).length,
        uptime: process.uptime(),
      },
    };

    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      status: "offline",
      timestamp: new Date().toISOString(),
      agentCount: 0,
      details: { error: message },
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/agents/:vpsAgentId/health — Per-agent container health
// ---------------------------------------------------------------------------

router.get("/api/agents/:vpsAgentId/health", async (req, res) => {
  try {
    const { vpsAgentId } = req.params;
    const health = await checkAgentContainerHealth(vpsAgentId);
    const port = getPort(vpsAgentId);

    const healthStatus: AgentHealthStatus = {
      vpsAgentId,
      status: health.status === "healthy" ? "running" : health.status === "not_deployed" ? "stopped" : "error",
      metadata: {
        containerPort: port,
        containerHealth: health.status,
      },
    };

    res.json(healthStatus);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      vpsAgentId: req.params.vpsAgentId,
      status: "error",
      metadata: { error: message },
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tenants/:businessSlug/containers — List containers for tenant
// ---------------------------------------------------------------------------

router.get("/api/tenants/:businessSlug/containers", async (req, res) => {
  try {
    const { businessSlug } = req.params;
    const containers = await listTenantContainers(businessSlug);
    const ports = getBusinessPorts(businessSlug);

    res.json({
      businessSlug,
      containers: containers.map((c) => ({
        ...c,
        port: ports.find((p) => p.vpsAgentId === c.vpsAgentId)?.port,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tenants/stop — Stop all containers for a tenant
// ---------------------------------------------------------------------------

router.post("/api/tenants/stop", async (req, res) => {
  try {
    const { businessSlug } = req.body as TenantLifecycleRequest;

    if (!businessSlug) {
      res.status(400).json({ success: false, error: "businessSlug is required" });
      return;
    }

    const stoppedCount = await stopTenantContainers(businessSlug);
    console.log(`[tenants/stop] Stopped ${stoppedCount} containers for ${businessSlug}`);

    res.json({ success: true, stoppedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[tenants/stop] Error: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tenants/resume — Resume all containers for a tenant
// ---------------------------------------------------------------------------

router.post("/api/tenants/resume", async (req, res) => {
  try {
    const { businessSlug } = req.body as TenantLifecycleRequest;

    if (!businessSlug) {
      res.status(400).json({ success: false, error: "businessSlug is required" });
      return;
    }

    const resumedCount = await resumeTenantContainers(businessSlug);
    console.log(`[tenants/resume] Resumed ${resumedCount} containers for ${businessSlug}`);

    res.json({ success: true, resumedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[tenants/resume] Error: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tenants/destroy — Stop + remove all containers and ports for a tenant
// ---------------------------------------------------------------------------

router.post("/api/tenants/destroy", async (req, res) => {
  try {
    const { businessSlug } = req.body as TenantLifecycleRequest;

    if (!businessSlug) {
      res.status(400).json({ success: false, error: "businessSlug is required" });
      return;
    }

    const stoppedCount = await stopTenantContainers(businessSlug);
    const releasedPorts = releaseBusinessPorts(businessSlug);

    // Remove containers
    const containers = await listTenantContainers(businessSlug);
    for (const c of containers) {
      try {
        const { execSync } = await import("node:child_process");
        execSync(`docker rm -f ${c.vpsAgentId} 2>/dev/null || true`, { timeout: 5000 });
      } catch {
        // ignore
      }
    }

    console.log(`[tenants/destroy] Destroyed ${stoppedCount} containers, released ${releasedPorts} ports for ${businessSlug}`);
    res.json({ success: true, stoppedCount, releasedPorts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[tenants/destroy] Error: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ports — Debug endpoint: show all port allocations
// ---------------------------------------------------------------------------

router.get("/api/ports", (_req, res) => {
  res.json(getAllPorts());
});

// ---------------------------------------------------------------------------
// POST /api/ports/reload — Reload port registry from disk
// ---------------------------------------------------------------------------

router.post("/api/ports/reload", (_req, res) => {
  loadPortRegistry();
  res.json({ success: true, ports: getAllPorts() });
});

// ---------------------------------------------------------------------------
// GET /healthz -- liveness probe (no auth required, mounted separately)
// ---------------------------------------------------------------------------

router.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

export default router;
