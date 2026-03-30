/**
 * VPS API proxy route handlers.
 *
 * Handles deployment packages, chat messages, task execution,
 * and health checks. Routes requests to OpenClaw gateway for
 * actual agent interaction. Uses dockerode for container management
 * and file-based persistence for deployment state.
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
import {
  createAgentContainer,
  countRunningAgents,
  stopTenantContainers,
  resumeTenantContainers,
  docker,
} from "./container-manager.js";
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

    // Step 3: Claude Code optimization via OpenClaw gateway
    let optimizationReport: DeployResult["optimizationReport"] | undefined;
    if (!payload.skipOptimization) {
      emitProgress("optimizing", "Sending workspace to Claude Code for optimization...");
      try {
        const filePreviews = payload.workspaceFiles.map((f) => ({
          path: f.path,
          preview: f.content.slice(0, 200),
        }));
        const result = await sendMessageToAgent(
          "system",
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
        // Per CONTEXT.md: "If Claude Code optimization fails, deployment fails"
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[deploy] Optimization failed for ${deployId}: ${errMsg}`);

        const failedState: DeploymentState = {
          deployId,
          status: "failed",
          startedAt: deployments.get(deployId)!.startedAt,
          completedAt: new Date().toISOString(),
        };
        deployments.set(deployId, failedState);
        saveDeploymentState(deployId, failedState);
        emitProgress("error", `Optimization failed: ${errMsg}`);
        return;
      }
    }

    // Step 4: Start/restart agent containers via dockerode
    emitProgress(
      "starting_containers",
      `Creating ${payload.agents.length} agent container(s)...`,
    );
    const agentResults: DeployResult["agentResults"] = [];

    for (const agent of payload.agents) {
      const workspacePath = path.join(
        tenantDir,
        "workspaces",
        agent.vpsAgentId,
      );
      const sharedPath = path.join(tenantDir, "shared");

      // Ensure directories exist
      fs.mkdirSync(workspacePath, { recursive: true });
      fs.mkdirSync(sharedPath, { recursive: true });

      try {
        await createAgentContainer(
          agent.vpsAgentId,
          workspacePath,
          sharedPath,
        );
        agentResults.push({
          agentId: agent.agentId,
          vpsAgentId: agent.vpsAgentId,
          status: "deployed",
        });
        deployEvents.emit(deployId, {
          type: "agent_status",
          agentId: agent.vpsAgentId,
          message: `Container ${agent.vpsAgentId} created and started`,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        agentResults.push({
          agentId: agent.agentId,
          vpsAgentId: agent.vpsAgentId,
          status: "failed",
          error: errMsg,
        });
        deployEvents.emit(deployId, {
          type: "agent_status",
          agentId: agent.vpsAgentId,
          message: `Container ${agent.vpsAgentId} failed: ${errMsg}`,
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
      error: anyFailed ? "One or more agent containers failed to start" : undefined,
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

    // Route message to OpenClaw gateway
    const result = await sendMessageToAgent(vpsAgentId, chatReq.message);

    const response: ChatResponse = {
      content: result.response,
      agentId: chatReq.agentId || vpsAgentId,
      toolCalls: [],
    };

    console.log(`[chat] Message routed to agent ${vpsAgentId}`);

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

    // Count running agent containers via dockerode
    const agentCount = await countRunningAgents();

    const status: HealthStatus = {
      status: gateway.status === "unreachable" ? "degraded" : "online",
      timestamp: new Date().toISOString(),
      agentCount,
      details: {
        proxy: "running",
        gateway: gateway.status,
        sessions: gateway.sessions,
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

    // Check actual Docker container status via dockerode
    let containerStatus: "running" | "stopped" | "error" = "stopped";
    let startedAt: string | undefined;

    try {
      const container = docker.getContainer(vpsAgentId);
      const info = await container.inspect();
      if (info.State.Running) {
        containerStatus = "running";
        startedAt = info.State.StartedAt;
      } else {
        containerStatus = "stopped";
      }
    } catch {
      // Container not found -- check if workspace exists on disk
      containerStatus = "stopped";
    }

    // Check if workspace directory exists on disk as supplementary info
    const tenantDataDir = getTenantDataDir();
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
      status: containerStatus,
      lastResponseAt: startedAt,
      metadata: {
        workspaceExists,
        containerStartedAt: startedAt,
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
// POST /api/tenants/stop
// ---------------------------------------------------------------------------

router.post("/api/tenants/stop", async (req, res) => {
  try {
    const { businessSlug } = req.body as TenantLifecycleRequest;

    if (!businessSlug) {
      res.status(400).json({ success: false, error: "businessSlug is required" });
      return;
    }

    const stoppedCount = await stopTenantContainers(businessSlug);
    res.json({ success: true, stoppedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[tenants/stop] Error: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tenants/resume
// ---------------------------------------------------------------------------

router.post("/api/tenants/resume", async (req, res) => {
  try {
    const { businessSlug } = req.body as TenantLifecycleRequest;

    if (!businessSlug) {
      res.status(400).json({ success: false, error: "businessSlug is required" });
      return;
    }

    const resumedCount = await resumeTenantContainers(businessSlug);
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
