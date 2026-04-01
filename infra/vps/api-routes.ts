/**
 * VPS API proxy route handlers.
 *
 * Handles deployment packages, chat messages, task execution,
 * and health checks. Routes requests to OpenClaw gateway for
 * actual agent interaction. Agents are managed via workspace files
 * and OpenClaw gateway registration (no Docker containers).
 */

import { Router } from "express";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  DeployPayload,
  DeployResult,
  DeploymentState,
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
  saveDeploymentState,
  loadAllDeploymentStates,
} from "./deploy-state.js";
// Note: container-manager.ts is deprecated — OpenClaw handles agent execution natively.
// Stop/resume now operates on gateway config, not Docker containers.
import {
  sendMessageToAgent,
  submitTaskToAgent,
  checkGatewayHealth,
} from "./openclaw-client.js";

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

const cancellationFlags = new Set<string>();

// ---------------------------------------------------------------------------
// Pending async chat results (in-memory, auto-cleaned after 10 min)
// ---------------------------------------------------------------------------

const pendingChats = new Map<string, AsyncChatState>();
const CHAT_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired chat results every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of pendingChats) {
    if (now - state.createdAt > CHAT_TTL_MS) {
      pendingChats.delete(id);
    }
  }
}, 2 * 60 * 1000);

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
      res
        .status(400)
        .json({ success: false, error: "businessSlug is required" });
      return;
    }
    if (!payload.agents || payload.agents.length === 0) {
      res.status(400).json({
        success: false,
        error: "agents array is required and must not be empty",
      });
      return;
    }
    if (!payload.workspaceFiles || payload.workspaceFiles.length === 0) {
      res.status(400).json({
        success: false,
        error: "workspaceFiles array is required and must not be empty",
      });
      return;
    }

    const deployId = payload.deploymentId || `deploy-${Date.now()}`;
    const tenantDir = path.join(getTenantDataDir(), payload.businessSlug);

    // Track deployment state (persisted)
    const initialState: DeploymentState = {
      deployId,
      status: "in_progress",
      startedAt: new Date().toISOString(),
    };
    deployments.set(deployId, initialState);
    saveDeploymentState(deployId, initialState);

    // Return immediately -- deploy pipeline runs async
    res.json({ success: true, deployId });

    // Run async deploy pipeline
    runDeployPipeline(deployId, payload, tenantDir).catch((err) => {
      console.error(`[deploy] Pipeline error for ${deployId}:`, err);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[deploy] Error: ${message}`);
    res
      .status(500)
      .json({ success: false, deployId: "", agentResults: [], error: message });
  }
});

/**
 * Async deployment pipeline. Emits progress events via deployEvents.
 */
async function runDeployPipeline(
  deployId: string,
  payload: DeployPayload,
  tenantDir: string,
): Promise<void> {
  const emitProgress = (
    phase: string,
    message: string,
  ): void => {
    deployEvents.emit(deployId, {
      type: "phase",
      phase,
      message,
      timestamp: new Date().toISOString(),
    });
  };

  try {
    // Check for cancellation
    if (cancellationFlags.has(deployId)) {
      cancellationFlags.delete(deployId);
      const cancelledState: DeploymentState = {
        deployId,
        status: "cancelled",
        startedAt: deployments.get(deployId)!.startedAt,
        completedAt: new Date().toISOString(),
      };
      deployments.set(deployId, cancelledState);
      saveDeploymentState(deployId, cancelledState);
      emitProgress("error", "Deployment cancelled");
      return;
    }

    // Step 1: Write workspace files to disk
    emitProgress("writing_files", "Writing workspace files to disk...");
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

    // Step 3: Claude Code optimization via OpenClaw gateway (best-effort)
    // Uses the first deployed agent (typically CEO) for optimization review.
    // If no agents are available or optimization fails, deployment continues.
    let optimizationReport: DeployResult["optimizationReport"] | undefined;
    if (!payload.skipOptimization && payload.agents.length > 0) {
      emitProgress("optimizing", "Sending workspace to Claude Code for optimization...");
      try {
        const filePreviews = payload.workspaceFiles.map((f) => ({
          path: f.path,
          preview: f.content.slice(0, 200),
        }));
        // Use the first agent (CEO) for optimization — avoids non-existent "system" agent
        const optimizerAgent = payload.agents[0].vpsAgentId;
        const result = await sendMessageToAgent(
          optimizerAgent,
          `Review and optimize these workspace files for tenant ${payload.businessSlug}:\n${JSON.stringify(filePreviews)}`,
        );

        // Try to parse optimization report from response
        try {
          const parsed = JSON.parse(result.response) as {
            changes?: Array<{ file: string; description: string }>;
            summary?: string;
          };
          if (parsed.changes && parsed.summary) {
            optimizationReport = {
              changes: parsed.changes,
              summary: parsed.summary,
            };
            // Write optimized files back to disk if changes provided
            for (const change of parsed.changes) {
              const optimizedContent = (
                parsed as Record<string, unknown>
              )[change.file] as string | undefined;
              if (optimizedContent) {
                const filePath = path.join(tenantDir, change.file);
                fs.writeFileSync(filePath, optimizedContent, "utf-8");
              }
            }
          }
        } catch {
          // Response was not structured JSON -- that's okay, treat as text report
          optimizationReport = {
            changes: [],
            summary: result.response.slice(0, 500),
          };
        }
      } catch (err) {
        // Optimization failure is non-fatal — log and continue deployment
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[deploy] Optimization failed for ${deployId} (non-fatal): ${errMsg}`);
        emitProgress("optimizing", `Optimization skipped: ${errMsg}`);
      }
    }

    // Step 4: Verify agent workspaces are ready (OpenClaw handles execution natively)
    emitProgress(
      "registering_agents",
      `Registering ${payload.agents.length} agent(s) in OpenClaw...`,
    );
    const agentResults: DeployResult["agentResults"] = [];

    for (const agent of payload.agents) {
      const workspacePath = path.join(
        tenantDir,
        "workspace",
        `workspace-${agent.vpsAgentId}`,
      );

      // Verify workspace directory and identity file exist
      const identityPath = path.join(workspacePath, "IDENTITY.md");
      const hasWorkspace = fs.existsSync(workspacePath);
      const hasIdentity = fs.existsSync(identityPath);

      if (hasWorkspace && hasIdentity) {
        agentResults.push({
          agentId: agent.agentId,
          vpsAgentId: agent.vpsAgentId,
          status: "deployed",
        });
        deployEvents.emit(deployId, {
          type: "agent_status",
          agentId: agent.vpsAgentId,
          message: `Agent ${agent.vpsAgentId} registered with workspace`,
          timestamp: new Date().toISOString(),
        });
      } else {
        agentResults.push({
          agentId: agent.agentId,
          vpsAgentId: agent.vpsAgentId,
          status: "failed",
          error: `Workspace not ready: workspace=${hasWorkspace}, identity=${hasIdentity}`,
        });
        deployEvents.emit(deployId, {
          type: "agent_status",
          agentId: agent.vpsAgentId,
          message: `Agent ${agent.vpsAgentId} failed: workspace files missing`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Determine overall success
    const anyFailed = agentResults.some((r) => r.status === "failed");
    const finalStatus = anyFailed ? "failed" : "completed";

    const result: DeployResult = {
      success: !anyFailed,
      deployId,
      agentResults,
      optimizationReport,
      error: anyFailed ? "One or more agents failed to register" : undefined,
    };

    // Update state
    const completedState: DeploymentState = {
      deployId,
      status: finalStatus,
      startedAt: deployments.get(deployId)!.startedAt,
      completedAt: new Date().toISOString(),
      result,
    };
    deployments.set(deployId, completedState);
    saveDeploymentState(deployId, completedState);

    console.log(
      `[deploy] Deployment ${deployId} ${finalStatus} for ${payload.businessSlug} (${payload.agents.length} agents)`,
    );

    emitProgress("complete", `Deployment ${finalStatus}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[deploy] Pipeline error for ${deployId}: ${errMsg}`);

    const failedState: DeploymentState = {
      deployId,
      status: "failed",
      startedAt: deployments.get(deployId)?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    deployments.set(deployId, failedState);
    saveDeploymentState(deployId, failedState);
    emitProgress("error", `Deployment failed: ${errMsg}`);
  }
}

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
  res.json({
    success: true,
    message: `Cancellation requested for deployment ${id}`,
  });
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
// POST /api/agents/:vpsAgentId/chat (async — returns immediately)
// ---------------------------------------------------------------------------

router.post("/api/agents/:vpsAgentId/chat", (req, res) => {
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

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Store pending state
    pendingChats.set(requestId, {
      requestId,
      status: "processing",
      createdAt: Date.now(),
    });

    // Return immediately
    res.json({ requestId, status: "processing" });

    // Process in background using non-streaming HTTP (reliable, no SSE parsing issues)
    console.log(`[chat] Async request ${requestId} submitted for agent ${vpsAgentId}`);

    // Forward all chat metadata to OpenClaw (agent targeting, session persistence, RAG context)
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

    // Validate required fields
    if (!taskReq.businessId) {
      res.status(400).json({ error: "businessId is required" });
      return;
    }
    if (!taskReq.taskId) {
      res.status(400).json({ error: "taskId is required" });
      return;
    }

    // Submit task to OpenClaw gateway
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
// GET /api/health
// ---------------------------------------------------------------------------

router.get("/api/health", async (_req, res) => {
  try {
    // Check OpenClaw gateway health
    const gateway = await checkGatewayHealth();

    // Count registered agents by scanning workspace directories
    const tenantDataDir = getTenantDataDir();
    let agentCount = 0;
    try {
      if (fs.existsSync(tenantDataDir)) {
        const tenants = fs.readdirSync(tenantDataDir);
        for (const tenant of tenants) {
          const workspaceDir = path.join(tenantDataDir, tenant, "workspace");
          if (fs.existsSync(workspaceDir)) {
            const entries = fs.readdirSync(workspaceDir);
            agentCount += entries.filter((e) => e.startsWith("workspace-")).length;
          }
        }
      }
    } catch {
      // Failed to count — not critical
    }

    const status: HealthStatus = {
      status: gateway.status === "unreachable" ? "degraded" : "online",
      timestamp: new Date().toISOString(),
      agentCount,
      details: {
        proxy: "running",
        gateway: gateway.status,
        sessions: gateway.sessions,
        tenantDataDir,
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
    const tenantDataDir = getTenantDataDir();

    // Parse business slug from vpsAgentId (format: {slug}-{dept}-{8charPrefix})
    // Slug can contain hyphens, so take everything before the last 2 segments
    const parts = vpsAgentId.split("-");
    let workspaceExists = false;
    let identityExists = false;
    if (parts.length >= 3) {
      const businessSlug = parts.slice(0, -2).join("-");
      const workspacePath = path.join(
        tenantDataDir,
        businessSlug,
        "workspace",
        `workspace-${vpsAgentId}`,
      );
      workspaceExists = fs.existsSync(workspacePath);
      identityExists = fs.existsSync(path.join(workspacePath, "IDENTITY.md"));
    }

    // Agent is "running" if workspace + identity files exist and gateway is reachable
    let agentStatus: "running" | "stopped" | "error" = "stopped";
    if (workspaceExists && identityExists) {
      const gateway = await checkGatewayHealth();
      agentStatus = gateway.status === "unreachable" ? "error" : "running";
    }

    const healthStatus: AgentHealthStatus = {
      vpsAgentId,
      status: agentStatus,
      metadata: {
        workspaceExists,
        identityExists,
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
// POST /api/tenants/stop — Remove tenant agents from OpenClaw gateway
// ---------------------------------------------------------------------------

router.post("/api/tenants/stop", async (req, res) => {
  try {
    const { businessSlug } = req.body as TenantLifecycleRequest;

    if (!businessSlug) {
      res.status(400).json({ success: false, error: "businessSlug is required" });
      return;
    }

    const gatewayConfigPath = path.join(
      process.env.HOME || "/root",
      ".openclaw",
      "openclaw.json",
    );

    let stoppedCount = 0;

    if (fs.existsSync(gatewayConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(gatewayConfigPath, "utf-8")) as {
          agents?: { list?: Array<{ id: string }> };
          mcp?: { servers?: Record<string, unknown> };
        };

        // Count agents being removed
        const beforeCount = config.agents?.list?.length ?? 0;

        // Remove this tenant's agents from the gateway config
        if (config.agents?.list) {
          config.agents.list = config.agents.list.filter(
            (a) => !a.id.startsWith(`${businessSlug}-`),
          );
        }

        // Remove this tenant's MCP servers
        if (config.mcp?.servers) {
          for (const key of Object.keys(config.mcp.servers)) {
            if (key.includes(businessSlug)) {
              delete config.mcp.servers[key];
            }
          }
        }

        stoppedCount = beforeCount - (config.agents?.list?.length ?? 0);

        fs.writeFileSync(gatewayConfigPath, JSON.stringify(config, null, 2), "utf-8");
        console.log(`[tenants/stop] Removed ${stoppedCount} agents for ${businessSlug} from gateway config`);

        // Restart gateway to apply changes
        const { execSync } = await import("node:child_process");
        try {
          execSync("systemctl --user restart openclaw-gateway", { timeout: 10000 });
        } catch {
          console.warn("[tenants/stop] Gateway restart failed (may not be systemd service)");
        }
      } catch (parseErr) {
        console.error("[tenants/stop] Failed to parse gateway config:", parseErr);
      }
    }

    res.json({ success: true, stoppedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[tenants/stop] Error: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tenants/resume — Re-register tenant agents from tenant config
// ---------------------------------------------------------------------------

router.post("/api/tenants/resume", async (req, res) => {
  try {
    const { businessSlug } = req.body as TenantLifecycleRequest;

    if (!businessSlug) {
      res.status(400).json({ success: false, error: "businessSlug is required" });
      return;
    }

    const tenantConfigPath = path.join(
      getTenantDataDir(),
      businessSlug,
      "config",
      "openclaw.json",
    );
    const gatewayConfigPath = path.join(
      process.env.HOME || "/root",
      ".openclaw",
      "openclaw.json",
    );

    let resumedCount = 0;

    if (fs.existsSync(tenantConfigPath) && fs.existsSync(gatewayConfigPath)) {
      try {
        const tenantConfig = JSON.parse(fs.readFileSync(tenantConfigPath, "utf-8")) as {
          agents?: { list?: Array<{ id: string }> };
          mcp?: { servers?: Record<string, unknown> };
        };
        const gatewayConfig = JSON.parse(fs.readFileSync(gatewayConfigPath, "utf-8")) as {
          agents?: { list?: Array<{ id: string }> };
          mcp?: { servers?: Record<string, unknown> };
        };

        // Remove any existing agents for this tenant first (idempotent)
        if (gatewayConfig.agents?.list) {
          gatewayConfig.agents.list = gatewayConfig.agents.list.filter(
            (a) => !a.id.startsWith(`${businessSlug}-`),
          );
        }

        // Add tenant agents back
        const tenantAgents = tenantConfig.agents?.list ?? [];
        if (!gatewayConfig.agents) {
          gatewayConfig.agents = { list: [] };
        }
        if (!gatewayConfig.agents.list) {
          gatewayConfig.agents.list = [];
        }
        gatewayConfig.agents.list.push(...tenantAgents);
        resumedCount = tenantAgents.length;

        // Merge MCP servers
        if (tenantConfig.mcp?.servers) {
          if (!gatewayConfig.mcp) gatewayConfig.mcp = { servers: {} };
          if (!gatewayConfig.mcp.servers) gatewayConfig.mcp.servers = {};
          Object.assign(gatewayConfig.mcp.servers, tenantConfig.mcp.servers);
        }

        fs.writeFileSync(gatewayConfigPath, JSON.stringify(gatewayConfig, null, 2), "utf-8");
        console.log(`[tenants/resume] Re-registered ${resumedCount} agents for ${businessSlug}`);

        // Restart gateway
        const { execSync } = await import("node:child_process");
        try {
          execSync("systemctl --user restart openclaw-gateway", { timeout: 10000 });
        } catch {
          console.warn("[tenants/resume] Gateway restart failed");
        }
      } catch (parseErr) {
        console.error("[tenants/resume] Failed to parse configs:", parseErr);
      }
    } else {
      console.warn(`[tenants/resume] Config not found for ${businessSlug}`);
    }

    res.json({ success: true, resumedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[tenants/resume] Error: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// GET /healthz -- liveness probe (no auth required, mounted separately)
// ---------------------------------------------------------------------------

router.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

export default router;
