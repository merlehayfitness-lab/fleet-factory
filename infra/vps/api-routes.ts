/**
 * VPS API proxy route handlers.
 *
 * Handles deployment packages, chat messages, task execution,
 * and health checks. Routes requests to OpenClaw gateway for
 * actual agent interaction.
 *
 * All OpenClaw integration points are STUBBED for MVP and marked
 * with TODO for activation when Claude Code is bootstrapped.
 */

import { Router } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  DeployPayload,
  DeployResult,
  DeploymentState,
  ChatRequest,
  ChatResponse,
  TaskRequest,
  TaskResult,
  HealthStatus,
  AgentHealthStatus,
} from "./api-types.js";

const router = Router();

// ---------------------------------------------------------------------------
// In-memory state (MVP -- replace with persistent store for production)
// ---------------------------------------------------------------------------

const deployments = new Map<string, DeploymentState>();
const cancellationFlags = new Set<string>();

function getTenantDataDir(): string {
  return process.env.TENANT_DATA_DIR || "/data/tenants";
}

// ---------------------------------------------------------------------------
// POST /api/deploy
// ---------------------------------------------------------------------------

router.post("/api/deploy", async (req, res) => {
  try {
    const payload = req.body as DeployPayload;

    // Validate required fields
    if (!payload.businessSlug) {
      res.status(400).json({ success: false, error: "businessSlug is required" });
      return;
    }
    if (!payload.agents || payload.agents.length === 0) {
      res.status(400).json({ success: false, error: "agents array is required and must not be empty" });
      return;
    }
    if (!payload.workspaceFiles || payload.workspaceFiles.length === 0) {
      res.status(400).json({ success: false, error: "workspaceFiles array is required and must not be empty" });
      return;
    }

    const deployId = payload.deploymentId || `deploy-${Date.now()}`;
    const tenantDir = path.join(getTenantDataDir(), payload.businessSlug);

    // Track deployment state
    deployments.set(deployId, {
      deployId,
      status: "in_progress",
      startedAt: new Date().toISOString(),
    });

    // Step 1: Write workspace files to disk
    // Structure: /data/tenants/{businessSlug}/workspaces/{vpsAgentId}/
    for (const file of payload.workspaceFiles) {
      const filePath = path.join(tenantDir, file.path);
      const fileDir = path.dirname(filePath);
      fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(filePath, file.content, "utf-8");
    }

    // Step 2: Write openclaw.json config
    if (payload.openclawConfig) {
      const configPath = path.join(tenantDir, "openclaw.json");
      fs.mkdirSync(tenantDir, { recursive: true });
      fs.writeFileSync(configPath, payload.openclawConfig, "utf-8");
    }

    // Step 3: Claude Code optimization
    // TODO: Activate when Claude Code is bootstrapped on VPS
    // When active:
    //   a. Send workspace files to Claude Code via OpenClaw gateway WebSocket
    //   b. Claude Code reviews and optimizes AGENTS.md, SOUL.md, etc.
    //   c. Collect optimization diff report
    //   d. Write optimized files back to disk
    // For MVP: skip optimization, just write files as-is
    let optimizationReport: DeployResult["optimizationReport"] | undefined;
    if (!payload.skipOptimization) {
      // STUB: Optimization would happen here via OpenClaw gateway
      optimizationReport = undefined; // No changes in stub mode
    }

    // Step 4: Start/restart agent containers
    // TODO: Activate when Claude Code is bootstrapped on VPS
    // When active:
    //   - Use Docker API or openclaw CLI to create/restart containers
    //   - Each agent gets its own sandbox container
    //   - Mount workspace as rw, shared dir as ro
    // For MVP: mark all agents as "deployed" (files written to disk)
    const agentResults: DeployResult["agentResults"] = payload.agents.map(
      (agent) => ({
        agentId: agent.agentId,
        vpsAgentId: agent.vpsAgentId,
        status: "deployed" as const,
      }),
    );

    // Check for cancellation
    if (cancellationFlags.has(deployId)) {
      cancellationFlags.delete(deployId);
      deployments.set(deployId, {
        deployId,
        status: "cancelled",
        startedAt: deployments.get(deployId)!.startedAt,
        completedAt: new Date().toISOString(),
      });
      res.json({ success: false, deployId, agentResults: [], error: "Deployment cancelled" });
      return;
    }

    const result: DeployResult = {
      success: true,
      deployId,
      agentResults,
      optimizationReport,
    };

    // Update state
    deployments.set(deployId, {
      deployId,
      status: "completed",
      startedAt: deployments.get(deployId)!.startedAt,
      completedAt: new Date().toISOString(),
      result,
    });

    console.log(
      `[deploy] Deployment ${deployId} completed for ${payload.businessSlug} (${payload.agents.length} agents)`,
    );

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[deploy] Error: ${message}`);
    res.status(500).json({ success: false, deployId: "", agentResults: [], error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/deploy/:id/cancel
// ---------------------------------------------------------------------------

router.post("/api/deploy/:id/cancel", (req, res) => {
  const { id } = req.params;
  const state = deployments.get(id);

  if (!state) {
    res.status(404).json({ success: false, error: "Deployment not found" });
    return;
  }

  if (state.status !== "in_progress") {
    res.status(400).json({
      success: false,
      error: `Cannot cancel deployment with status: ${state.status}`,
    });
    return;
  }

  cancellationFlags.add(id);
  res.json({ success: true, message: `Cancellation requested for deployment ${id}` });
});

// ---------------------------------------------------------------------------
// GET /api/deploy/:id/status
// ---------------------------------------------------------------------------

router.get("/api/deploy/:id/status", (req, res) => {
  const { id } = req.params;
  const state = deployments.get(id);

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
// POST /api/agents/:vpsAgentId/chat
// ---------------------------------------------------------------------------

router.post("/api/agents/:vpsAgentId/chat", async (req, res) => {
  try {
    const { vpsAgentId } = req.params;
    const chatReq = req.body as ChatRequest;

    // Validate required fields
    if (!chatReq.businessId) {
      res.status(400).json({ error: "businessId is required" });
      return;
    }
    if (!chatReq.message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // TODO: Activate when Claude Code is bootstrapped on VPS
    // When active:
    //   1. Route message to OpenClaw agent via gateway WebSocket or HTTP endpoint
    //   2. POST /v1/chat/completions on OpenClaw gateway with agent routing
    //   3. Return actual agent response with tool calls
    // For MVP: return a stub response

    const response: ChatResponse = {
      content: `I received your message. [VPS agent ${vpsAgentId} response will appear here when Claude Code is bootstrapped]`,
      agentId: chatReq.agentId || vpsAgentId,
      toolCalls: [],
    };

    console.log(`[chat] Message routed to agent ${vpsAgentId} (stub mode)`);

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[chat] Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/agents/:vpsAgentId/task
// ---------------------------------------------------------------------------

router.post("/api/agents/:vpsAgentId/task", async (req, res) => {
  try {
    const { vpsAgentId } = req.params;
    const taskReq = req.body as TaskRequest;

    // Validate required fields
    if (!taskReq.businessId) {
      res.status(400).json({ error: "businessId is required" });
      return;
    }
    if (!taskReq.taskId) {
      res.status(400).json({ error: "taskId is required" });
      return;
    }

    // TODO: Activate when Claude Code is bootstrapped on VPS
    // When active:
    //   1. Submit task to OpenClaw agent via gateway
    //   2. Wait for execution result (with timeout)
    //   3. Return actual tool execution result with token usage
    // For MVP: return a stub success result

    const result: TaskResult = {
      taskId: taskReq.taskId,
      success: true,
      result: {
        message: `Task received by agent ${vpsAgentId}. [Real execution will happen when Claude Code is bootstrapped]`,
      },
      toolsUsed: [],
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0 },
    };

    console.log(`[task] Task ${taskReq.taskId} submitted to agent ${vpsAgentId} (stub mode)`);

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[task] Error: ${message}`);
    res.status(500).json({ taskId: "", success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

router.get("/api/health", async (_req, res) => {
  try {
    // TODO: Activate when Claude Code is bootstrapped on VPS
    // When active:
    //   - Check OpenClaw gateway /healthz endpoint
    //   - Count running agent containers
    //   - Report degraded if gateway unreachable but proxy is running
    // For MVP: report online with basic info

    const openclawWsUrl = process.env.OPENCLAW_WS_URL || "ws://127.0.0.1:18789";
    let gatewayStatus = "unknown";

    // Check if OpenClaw gateway is reachable via HTTP
    // The gateway HTTP API runs on port 18790 by default
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const gatewayHttpUrl = openclawWsUrl
        .replace("ws://", "http://")
        .replace(":18789", ":18790");
      const response = await fetch(`${gatewayHttpUrl}/healthz`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      gatewayStatus = response.ok ? "connected" : "error";
    } catch {
      gatewayStatus = "unreachable";
    }

    const status: HealthStatus = {
      status: gatewayStatus === "connected" ? "online" : "degraded",
      timestamp: new Date().toISOString(),
      agentCount: 0, // TODO: count running agent containers
      details: {
        proxy: "running",
        gateway: gatewayStatus,
        tenantDataDir: getTenantDataDir(),
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
// GET /api/agents/:vpsAgentId/health
// ---------------------------------------------------------------------------

router.get("/api/agents/:vpsAgentId/health", async (req, res) => {
  try {
    const { vpsAgentId } = req.params;

    // TODO: Activate when Claude Code is bootstrapped on VPS
    // When active:
    //   - Check if the specific agent container is running via Docker API
    //   - Check if OpenClaw gateway /readyz reports agent as ready
    //   - Return last response timestamp from agent state
    // For MVP: check if workspace directory exists on disk

    const tenantDataDir = getTenantDataDir();
    // Parse business slug from vpsAgentId (format: {slug}-{dept}-{prefix})
    const parts = vpsAgentId.split("-");
    let workspaceExists = false;

    if (parts.length >= 3) {
      const businessSlug = parts[0];
      const workspacePath = path.join(
        tenantDataDir,
        businessSlug,
        "workspaces",
        vpsAgentId,
      );
      workspaceExists = fs.existsSync(workspacePath);
    }

    const healthStatus: AgentHealthStatus = {
      vpsAgentId,
      status: workspaceExists ? "running" : "stopped",
      lastResponseAt: workspaceExists ? new Date().toISOString() : undefined,
      metadata: {
        workspaceExists,
        mode: "stub", // TODO: Remove when real container management is active
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
// GET /healthz -- liveness probe (no auth required, mounted separately)
// ---------------------------------------------------------------------------

router.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

export default router;
