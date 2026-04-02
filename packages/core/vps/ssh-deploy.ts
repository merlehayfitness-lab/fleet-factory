/**
 * SSH-based deployment service — Docker container per agent.
 *
 * CEO-first cascading deployment:
 * 1. Upload workspace files via SFTP
 * 2. Deploy CEO agent in its own Docker container with OpenClaw
 * 3. Commit CEO container as template image
 * 4. Deploy department head containers from the template (overwrite identity files)
 * 5. Verify all containers healthy
 *
 * Each agent runs its own OpenClaw gateway instance on a unique host port.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  execCommand,
  writeRemoteFile,
  disconnect,
  isSshConfigured,
  type SshConfig,
  type SshProgressCallback,
} from "./ssh-client";
import { updateAgentVpsStatus } from "./vps-health";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SshDeployOptions {
  businessId: string;
  businessSlug: string;
  deploymentId: string;
  subdomain?: string;
  agents: SshDeployAgent[];
  workspaceFiles: Array<{ path: string; content: string }>;
  openclawConfig: string;
  onProgress?: SshProgressCallback;
  sshConfig?: SshConfig;
  mcpNpmPackages?: string[];
  /** Anthropic API key for this business (per-tenant cost isolation) */
  anthropicApiKey?: string;
}

export interface SshDeployAgent {
  agentId: string;
  vpsAgentId: string;
  departmentType: string;
  model: string;
  isCeo: boolean;
  templateName: string;
  skillsPackage?: unknown[];
  mcpServers?: unknown[];
  tokenBudget?: number;
  roleLevel?: number;
}

export interface SshDeployResult {
  success: boolean;
  agentResults: Array<{
    agentId: string;
    vpsAgentId: string;
    status: "deployed" | "failed";
    port?: number;
    error?: string;
  }>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_DATA_DIR = "/data/tenants";
const AGENT_IMAGE = "fleet-factory/agent:latest";
const CONTAINER_PORT = 18789;
const HEALTH_CHECK_TIMEOUT_MS = 60_000;
const HEALTH_CHECK_INTERVAL_MS = 3_000;
/** Static gateway password for container OpenClaw instances (host-local only) */
const GATEWAY_PASSWORD = "fleetfactory2026";

// ---------------------------------------------------------------------------
// Main deployment function (Docker CEO-first flow)
// ---------------------------------------------------------------------------

/**
 * Deploy a full business to VPS via SSH using Docker containers.
 *
 * Phase 0: Cleanup old containers for this tenant
 * Phase A: Upload workspace files + OpenClaw config
 * Phase B: Deploy CEO container, health check
 * Phase C: Commit CEO container as template image
 * Phase D: Deploy department head containers from template
 * Phase E: Register ports and update statuses
 */
export async function sshDeployBusiness(
  supabase: SupabaseClient,
  options: SshDeployOptions,
): Promise<SshDeployResult> {
  if (!isSshConfigured(options.sshConfig)) {
    return {
      success: false,
      agentResults: [],
      error: "SSH not configured (VPS_SSH_HOST and VPS_SSH_KEY_PATH or VPS_SSH_PASSWORD required)",
    };
  }

  const log = options.onProgress ?? console.log;
  const tenantDir = `${TENANT_DATA_DIR}/${options.businessSlug}`;
  const agentResults: SshDeployResult["agentResults"] = [];

  try {
    // Sort agents: CEO first, then department heads
    const sortedAgents = [...options.agents].sort((a, b) => {
      if (a.isCeo && !b.isCeo) return -1;
      if (!a.isCeo && b.isCeo) return 1;
      return 0;
    });

    const ceoAgent = sortedAgents.find((a) => a.isCeo);
    if (!ceoAgent) {
      return { success: false, agentResults: [], error: "No CEO agent found in deployment" };
    }

    // -----------------------------------------------------------------------
    // Phase 0: Cleanup old containers for this tenant
    // -----------------------------------------------------------------------
    log("[ssh] Phase 0: Cleaning up old containers");
    await execCommand(
      `docker stop $(docker ps --filter "label=tenant=${options.businessSlug}" -q) 2>/dev/null || true`,
      { sshConfig: options.sshConfig },
    );
    await execCommand(
      `docker rm $(docker ps -a --filter "label=tenant=${options.businessSlug}" -q) 2>/dev/null || true`,
      { sshConfig: options.sshConfig },
    );

    // Release old port allocations (proxy-side, will be re-allocated below)
    // Port registry is managed on proxy — we pass port assignments back in results
    log("[ssh] Old containers removed");

    // -----------------------------------------------------------------------
    // Phase A: Upload workspace files + config
    // -----------------------------------------------------------------------
    log("[ssh] Phase A: Uploading workspace files");
    await execCommand(
      `mkdir -p "${tenantDir}/workspace" "${tenantDir}/memory" "${tenantDir}/config"`,
      { sshConfig: options.sshConfig },
    );

    // Upload workspace files
    log(`[ssh] Uploading ${options.workspaceFiles.length} workspace files`);
    for (const file of options.workspaceFiles) {
      const remotePath = `${tenantDir}/workspace/${file.path}`;
      await writeRemoteFile(remotePath, file.content, options.sshConfig);
    }

    // Install MCP npm packages globally (non-fatal)
    if (options.mcpNpmPackages && options.mcpNpmPackages.length > 0) {
      const pkgs = options.mcpNpmPackages.join(" ");
      log(`[ssh] Installing MCP packages: ${pkgs}`);
      await execCommand(`npm install -g ${pkgs}`, {
        timeout: 120000,
        sshConfig: options.sshConfig,
      });
    }

    // Upload OpenClaw config
    log("[ssh] Writing OpenClaw config");
    await writeRemoteFile(
      `${tenantDir}/config/openclaw.json`,
      options.openclawConfig,
      options.sshConfig,
    );

    // Verify Docker image exists
    const imageCheck = await execCommand(
      `docker image inspect ${AGENT_IMAGE} > /dev/null 2>&1 && echo "exists" || echo "missing"`,
      { sshConfig: options.sshConfig },
    );
    if (imageCheck.stdout.trim() !== "exists") {
      return {
        success: false,
        agentResults: [],
        error: `Docker image ${AGENT_IMAGE} not found on VPS. Build it first: docker build -t ${AGENT_IMAGE} -f Dockerfile.agent .`,
      };
    }

    // -----------------------------------------------------------------------
    // Phase B: Deploy CEO container
    // -----------------------------------------------------------------------
    log("[ssh] Phase B: Deploying CEO container");

    // Allocate port for CEO (use a simple sequential port allocation via SSH)
    const ceoPort = await allocateNextPort(options.businessSlug, ceoAgent.vpsAgentId, options.sshConfig);
    log(`[ssh] CEO port: ${ceoPort}`);

    // Create memory dir for CEO
    await execCommand(
      `mkdir -p "${tenantDir}/memory/${ceoAgent.vpsAgentId}"`,
      { sshConfig: options.sshConfig },
    );

    const ceoResult = await deployContainer({
      vpsAgentId: ceoAgent.vpsAgentId,
      businessSlug: options.businessSlug,
      departmentType: ceoAgent.departmentType,
      model: ceoAgent.model,
      isCeo: true,
      hostPort: ceoPort,
      tenantDir,
      anthropicApiKey: options.anthropicApiKey ?? "",
      tokenBudget: ceoAgent.tokenBudget ?? 100000,
      image: AGENT_IMAGE,
      sshConfig: options.sshConfig,
      log,
    });

    if (!ceoResult.success) {
      agentResults.push({
        agentId: ceoAgent.agentId,
        vpsAgentId: ceoAgent.vpsAgentId,
        status: "failed",
        error: ceoResult.error,
      });
      await updateAgentVpsStatus(supabase, options.businessId, ceoAgent.agentId, ceoAgent.vpsAgentId, "error");
      return { success: false, agentResults, error: `CEO deployment failed: ${ceoResult.error}` };
    }

    agentResults.push({
      agentId: ceoAgent.agentId,
      vpsAgentId: ceoAgent.vpsAgentId,
      status: "deployed",
      port: ceoPort,
    });
    await updateAgentVpsStatus(supabase, options.businessId, ceoAgent.agentId, ceoAgent.vpsAgentId, "running");
    log("[ssh] CEO container healthy");

    // -----------------------------------------------------------------------
    // Phase C: Commit CEO container as template image
    // -----------------------------------------------------------------------
    log("[ssh] Phase C: Committing CEO as template image");
    const templateImage = `${options.businessSlug}-base:latest`;
    const commitResult = await execCommand(
      `docker commit ${ceoAgent.vpsAgentId} ${templateImage}`,
      { sshConfig: options.sshConfig },
    );
    if (commitResult.code !== 0) {
      log(`[ssh] WARNING: docker commit failed: ${commitResult.stderr}. Falling back to base image.`);
    } else {
      log(`[ssh] Template image created: ${templateImage}`);
    }

    const useTemplateImage = commitResult.code === 0 ? templateImage : AGENT_IMAGE;

    // -----------------------------------------------------------------------
    // Phase D: Deploy department head containers
    // -----------------------------------------------------------------------
    const departmentHeads = sortedAgents.filter((a) => !a.isCeo);
    log(`[ssh] Phase D: Deploying ${departmentHeads.length} department head containers`);

    for (const agent of departmentHeads) {
      log(`[ssh] Deploying ${agent.vpsAgentId} (${agent.departmentType})`);

      // Copy CEO workspace then overwrite identity files
      const agentWorkspaceDir = `${tenantDir}/workspace/workspace-${agent.vpsAgentId}`;
      const ceoWorkspaceDir = `${tenantDir}/workspace/workspace-${ceoAgent.vpsAgentId}`;

      await execCommand(
        `cp -r "${ceoWorkspaceDir}/." "${agentWorkspaceDir}/"`,
        { sshConfig: options.sshConfig },
      );

      // Overwrite identity-specific files
      const identityFiles = ["SOUL.md", "IDENTITY.md", "TOOLS.md", "SKILL.md"];
      for (const fname of identityFiles) {
        const uploadedFile = options.workspaceFiles.find(
          (f) => f.path === `workspace-${agent.vpsAgentId}/${fname}`,
        );
        if (uploadedFile) {
          await writeRemoteFile(`${agentWorkspaceDir}/${fname}`, uploadedFile.content, options.sshConfig);
        }
      }

      // Allocate port
      const agentPort = await allocateNextPort(options.businessSlug, agent.vpsAgentId, options.sshConfig);

      // Create memory dir
      await execCommand(
        `mkdir -p "${tenantDir}/memory/${agent.vpsAgentId}"`,
        { sshConfig: options.sshConfig },
      );

      const agentResult = await deployContainer({
        vpsAgentId: agent.vpsAgentId,
        businessSlug: options.businessSlug,
        departmentType: agent.departmentType,
        model: agent.model,
        isCeo: false,
        hostPort: agentPort,
        tenantDir,
        anthropicApiKey: options.anthropicApiKey ?? "",
        tokenBudget: agent.tokenBudget ?? 100000,
        image: useTemplateImage,
        sshConfig: options.sshConfig,
        log,
      });

      if (!agentResult.success) {
        agentResults.push({
          agentId: agent.agentId,
          vpsAgentId: agent.vpsAgentId,
          status: "failed",
          error: agentResult.error,
        });
        await updateAgentVpsStatus(supabase, options.businessId, agent.agentId, agent.vpsAgentId, "error");
        log(`[ssh] ${agent.vpsAgentId} FAILED: ${agentResult.error}`);
      } else {
        agentResults.push({
          agentId: agent.agentId,
          vpsAgentId: agent.vpsAgentId,
          status: "deployed",
          port: agentPort,
        });
        await updateAgentVpsStatus(supabase, options.businessId, agent.agentId, agent.vpsAgentId, "running");
        log(`[ssh] ${agent.vpsAgentId} healthy on port ${agentPort}`);
      }
    }

    // -----------------------------------------------------------------------
    // Phase E: Report
    // -----------------------------------------------------------------------
    const deployedCount = agentResults.filter((r) => r.status === "deployed").length;
    const totalCount = agentResults.length;
    const allDeployed = deployedCount === totalCount;

    log(`[ssh] Deployment ${allDeployed ? "complete" : "partial"}: ${deployedCount}/${totalCount} agents running`);

    return { success: allDeployed, agentResults };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown SSH deployment error";
    log(`[ssh] Deployment error: ${errorMsg}`);
    return { success: false, agentResults, error: errorMsg };
  } finally {
    disconnect();
  }
}

/**
 * Deploy a single agent to an existing tenant via SSH (hot-add).
 * Used for CEO "hiring" sub-agents after initial deployment.
 * Copies CEO workspace, overwrites identity files, starts container.
 */
export async function sshDeployAgent(
  supabase: SupabaseClient,
  businessSlug: string,
  businessId: string,
  agent: SshDeployAgent,
  workspaceFiles: Array<{ path: string; content: string }>,
  onProgress?: SshProgressCallback,
  options?: {
    ceoVpsAgentId?: string;
    sshConfig?: SshConfig;
    anthropicApiKey?: string;
  },
): Promise<SshDeployResult> {
  if (!isSshConfigured(options?.sshConfig)) {
    return { success: false, agentResults: [], error: "SSH not configured" };
  }

  const log = onProgress ?? console.log;
  const tenantDir = `${TENANT_DATA_DIR}/${businessSlug}`;
  const agentWorkspaceDir = `${tenantDir}/workspace/workspace-${agent.vpsAgentId}`;

  try {
    // Copy CEO workspace if available and this is a sub-agent
    if (options?.ceoVpsAgentId && !agent.isCeo) {
      const ceoWorkspaceDir = `${tenantDir}/workspace/workspace-${options.ceoVpsAgentId}`;
      log(`[ssh] Copying CEO workspace to ${agent.vpsAgentId}`);
      await execCommand(
        `cp -r "${ceoWorkspaceDir}/." "${agentWorkspaceDir}/"`,
        { sshConfig: options.sshConfig },
      );

      const identityFiles = ["SOUL.md", "IDENTITY.md", "TOOLS.md", "SKILL.md"];
      for (const fname of identityFiles) {
        const uploadedFile = workspaceFiles.find(
          (f) => f.path === `workspace-${agent.vpsAgentId}/${fname}`,
        );
        if (uploadedFile) {
          await writeRemoteFile(`${agentWorkspaceDir}/${fname}`, uploadedFile.content, options.sshConfig);
        }
      }
    } else {
      log(`[ssh] Uploading workspace for ${agent.vpsAgentId}`);
      for (const file of workspaceFiles) {
        const remotePath = `${tenantDir}/workspace/${file.path}`;
        await writeRemoteFile(remotePath, file.content, options?.sshConfig);
      }
    }

    // Allocate port
    const agentPort = await allocateNextPort(businessSlug, agent.vpsAgentId, options?.sshConfig);

    // Create memory dir
    await execCommand(
      `mkdir -p "${tenantDir}/memory/${agent.vpsAgentId}"`,
      { sshConfig: options?.sshConfig },
    );

    // Try to use the business template image, fall back to base
    const templateImage = `${businessSlug}-base:latest`;
    const imageCheck = await execCommand(
      `docker image inspect ${templateImage} > /dev/null 2>&1 && echo "exists" || echo "missing"`,
      { sshConfig: options?.sshConfig },
    );
    const image = imageCheck.stdout.trim() === "exists" ? templateImage : AGENT_IMAGE;

    const result = await deployContainer({
      vpsAgentId: agent.vpsAgentId,
      businessSlug,
      departmentType: agent.departmentType,
      model: agent.model,
      isCeo: agent.isCeo,
      hostPort: agentPort,
      tenantDir,
      anthropicApiKey: options?.anthropicApiKey ?? "",
      tokenBudget: agent.tokenBudget ?? 100000,
      image,
      sshConfig: options?.sshConfig,
      log,
    });

    const status = result.success ? "deployed" : "failed";
    await updateAgentVpsStatus(
      supabase, businessId, agent.agentId, agent.vpsAgentId,
      result.success ? "running" : "error",
    );

    return {
      success: result.success,
      agentResults: [{
        agentId: agent.agentId,
        vpsAgentId: agent.vpsAgentId,
        status,
        port: result.success ? agentPort : undefined,
        error: result.error,
      }],
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, agentResults: [], error: errorMsg };
  } finally {
    disconnect();
  }
}

// ---------------------------------------------------------------------------
// Docker container helpers
// ---------------------------------------------------------------------------

interface DeployContainerOptions {
  vpsAgentId: string;
  businessSlug: string;
  departmentType: string;
  model: string;
  isCeo: boolean;
  hostPort: number;
  tenantDir: string;
  anthropicApiKey: string;
  tokenBudget: number;
  image: string;
  sshConfig?: SshConfig;
  log: SshProgressCallback;
}

/**
 * Run a Docker container for an agent and wait until healthy.
 */
async function deployContainer(
  opts: DeployContainerOptions,
): Promise<{ success: boolean; error?: string }> {
  const {
    vpsAgentId, businessSlug, departmentType, model, isCeo,
    hostPort, tenantDir, anthropicApiKey, tokenBudget, image,
    sshConfig, log,
  } = opts;

  // Remove existing container with same name (idempotent)
  await execCommand(
    `docker rm -f ${vpsAgentId} 2>/dev/null || true`,
    { sshConfig },
  );

  // Build docker run command
  const dockerCmd = [
    "docker run -d",
    `--name ${vpsAgentId}`,
    `--label fleet-factory=true`,
    `--label tenant=${businessSlug}`,
    `-e AGENT_ID=${vpsAgentId}`,
    `-e BUSINESS_SLUG=${businessSlug}`,
    `-e DEPARTMENT_TYPE=${departmentType}`,
    `-e MODEL=${model}`,
    `-e PORT=${CONTAINER_PORT}`,
    `-e IS_CEO=${isCeo}`,
    `-e TOKEN_BUDGET=${tokenBudget}`,
    `-e MEMORY_DIR=/memory`,
    `-e ANTHROPIC_API_KEY=${anthropicApiKey}`,
    `-e OPENCLAW_GATEWAY_PASSWORD=${GATEWAY_PASSWORD}`,
    `-v ${tenantDir}/workspace/workspace-${vpsAgentId}:/workspace:rw`,
    `-v ${tenantDir}/config:/config:ro`,
    `-v ${tenantDir}/memory/${vpsAgentId}:/memory:rw`,
    `-p ${hostPort}:${CONTAINER_PORT}`,
    `--memory=512m`,
    `--cpus=0.5`,
    `--restart=unless-stopped`,
    image,
  ].join(" ");

  log(`[ssh] Starting container ${vpsAgentId} on port ${hostPort}`);
  const runResult = await execCommand(dockerCmd, { sshConfig });

  if (runResult.code !== 0) {
    return { success: false, error: `docker run failed: ${runResult.stderr}` };
  }

  // Health check loop — curl from host via port mapping (gateway binds 0.0.0.0 with password auth)
  const startTime = Date.now();
  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT_MS) {
    const healthResult = await execCommand(
      `curl -sf -H "Authorization: Bearer ${GATEWAY_PASSWORD}" http://127.0.0.1:${hostPort}/healthz 2>/dev/null && echo "OK" || echo "FAIL"`,
      { sshConfig },
    );

    if (healthResult.stdout.includes("OK")) {
      return { success: true };
    }

    // Check if container is still running
    const stateResult = await execCommand(
      `docker inspect --format '{{.State.Status}}' ${vpsAgentId} 2>/dev/null || echo "gone"`,
      { sshConfig },
    );

    if (stateResult.stdout.trim() !== "running") {
      // Get container logs for debugging
      const logsResult = await execCommand(
        `docker logs --tail 20 ${vpsAgentId} 2>&1`,
        { sshConfig },
      );
      return {
        success: false,
        error: `Container exited (state: ${stateResult.stdout.trim()}). Logs:\n${logsResult.stdout}`,
      };
    }

    await sleep(HEALTH_CHECK_INTERVAL_MS);
  }

  // Timeout — get logs for debugging
  const logsResult = await execCommand(
    `docker logs --tail 20 ${vpsAgentId} 2>&1`,
    { sshConfig },
  );
  return {
    success: false,
    error: `Health check timeout after ${HEALTH_CHECK_TIMEOUT_MS / 1000}s. Logs:\n${logsResult.stdout}`,
  };
}

/**
 * Allocate the next available port for a container on the VPS.
 * Uses the port-registry.json file on the VPS.
 */
async function allocateNextPort(
  businessSlug: string,
  vpsAgentId: string,
  sshConfig?: SshConfig,
): Promise<number> {
  const registryPath = "/data/state/port-registry.json";

  // Read existing registry
  const readResult = await execCommand(
    `cat "${registryPath}" 2>/dev/null || echo "{}"`,
    { sshConfig },
  );

  let registry: Record<string, { port: number; businessSlug: string }> = {};
  try {
    registry = JSON.parse(readResult.stdout);
  } catch {
    registry = {};
  }

  // Check if this agent already has a port
  if (registry[vpsAgentId]) {
    return registry[vpsAgentId].port;
  }

  // Find next available port starting at 19001
  const usedPorts = new Set(Object.values(registry).map((e) => e.port));
  let port = 19001;
  while (usedPorts.has(port)) {
    port++;
  }

  // Write back
  registry[vpsAgentId] = { port, businessSlug };
  await execCommand(
    `mkdir -p /data/state && cat > "${registryPath}" << 'REGEOF'\n${JSON.stringify(registry, null, 2)}\nREGEOF`,
    { sshConfig },
  );

  return port;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
