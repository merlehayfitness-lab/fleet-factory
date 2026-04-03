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
  /** Anthropic API key or OAuth token for this business */
  anthropicApiKey?: string;
  /** Slack bot token (xoxb-...) for native channel integration */
  slackBotToken?: string;
  /** Slack app-level token (xapp-...) for socket mode */
  slackAppToken?: string;
  /** Slack team/workspace ID (T...) */
  slackTeamId?: string;
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

const AGENT_IMAGE = "fleet-factory/agent:latest";

/** Per-business tenant directory under the business user's home */
function getTenantDir(businessSlug: string): string {
  return `/home/${businessSlug}/tenants/${businessSlug}`;
}
const CONTAINER_PORT = 18789;
const HEALTH_CHECK_TIMEOUT_MS = 60_000;
const HEALTH_CHECK_INTERVAL_MS = 3_000;
/** Static gateway password for container OpenClaw instances (host-local only) */
const GATEWAY_PASSWORD = "fleetfactory2026";

// ---------------------------------------------------------------------------
// Pre-deployment: ensure Linux user + Docker image exist
// ---------------------------------------------------------------------------

/**
 * Create a non-root Linux user for this business and set up directory structure.
 * Idempotent — skips if user already exists.
 */
async function ensureBusinessUser(
  businessSlug: string,
  sshConfig?: SshConfig,
  log: SshProgressCallback = console.log,
): Promise<void> {
  const tenantDir = getTenantDir(businessSlug);

  // Create user if it doesn't exist (--create-home makes /home/{slug})
  await execCommand(
    `id "${businessSlug}" &>/dev/null || useradd --create-home --shell /bin/bash "${businessSlug}"`,
    { sshConfig },
  );

  // Create directory structure under user's home
  await execCommand(
    `mkdir -p "${tenantDir}/workspace" "${tenantDir}/memory" "${tenantDir}/config"`,
    { sshConfig },
  );

  // Set up OpenClaw dirs for OAuth token sharing
  await execCommand(
    `mkdir -p "/home/${businessSlug}/.openclaw/agents"`,
    { sshConfig },
  );

  // Copy OAuth credentials from Claude Code if available
  await execCommand(
    `if [ -f /root/.claude/.credentials.json ]; then
      python3 -c "
import json
with open('/root/.claude/.credentials.json') as f:
    creds = json.load(f)
oauth = creds.get('claudeAiOauth', {})
if oauth.get('accessToken'):
    profile = {
        'version': 1,
        'profiles': {
            'anthropic:oauth': {
                'type': 'oauth',
                'provider': 'anthropic',
                'access': oauth['accessToken'],
                'refresh': oauth.get('refreshToken', ''),
                'expires': oauth.get('expiresAt', 0)
            }
        },
        'lastGood': {'anthropic': 'anthropic:oauth'},
        'usageStats': {}
    }
    with open('/home/${businessSlug}/.openclaw/auth-profiles.json', 'w') as f:
        json.dump(profile, f, indent=2)
    print('OAuth token copied')
else:
    print('No OAuth token found')
"
    fi`,
    { sshConfig },
  );

  // Set ownership
  await execCommand(
    `chown -R "${businessSlug}:${businessSlug}" "/home/${businessSlug}"`,
    { sshConfig },
  );

  log(`[ssh] Business user "${businessSlug}" ready`);
}

/**
 * Ensure the Docker agent image exists on the VPS. Auto-builds if missing.
 */
async function ensureAgentImage(
  sshConfig?: SshConfig,
  log: SshProgressCallback = console.log,
): Promise<void> {
  const imageCheck = await execCommand(
    `docker image inspect ${AGENT_IMAGE} > /dev/null 2>&1 && echo "exists" || echo "missing"`,
    { sshConfig },
  );

  if (imageCheck.stdout.trim() === "exists") {
    log("[ssh] Docker agent image found");
    return;
  }

  log("[ssh] Docker agent image missing — building...");

  // Upload Dockerfile and entrypoint to a temp build dir
  const buildDir = "/tmp/fleet-factory-build";
  await execCommand(`mkdir -p ${buildDir}`, { sshConfig });

  // The Dockerfile and entrypoint are at known paths on this VPS
  // (placed during initial setup or by the admin). If they exist in
  // infra/vps/ on the VPS, use them. Otherwise, copy from the standard location.
  await execCommand(
    `if [ -f /data/tenants/fleet-test-2/frontend/infra/vps/Dockerfile.agent ]; then
       cp /data/tenants/fleet-test-2/frontend/infra/vps/Dockerfile.agent ${buildDir}/Dockerfile.agent
       cp /data/tenants/fleet-test-2/frontend/infra/vps/agent-entrypoint.sh ${buildDir}/agent-entrypoint.sh
     fi`,
    { sshConfig },
  );

  const buildResult = await execCommand(
    `cd ${buildDir} && docker build -t ${AGENT_IMAGE} -f Dockerfile.agent . 2>&1`,
    { sshConfig, timeout: 180000 },
  );

  if (buildResult.code !== 0) {
    throw new Error(`Docker image build failed: ${buildResult.stderr || buildResult.stdout}`);
  }

  log("[ssh] Docker agent image built successfully");
}

// ---------------------------------------------------------------------------
// Main deployment function (Docker CEO-first flow)
// ---------------------------------------------------------------------------

/**
 * Deploy a full business to VPS via SSH using Docker containers.
 *
 * Phase 0: Cleanup old containers for this tenant
 * Phase A: Upload workspace files + OpenClaw config + TEAM_PLAN.md
 * Phase B: Deploy CEO container with Docker socket (CEO self-deploys sub-agents)
 * Phase C: Verify CEO healthy + Slack connected
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
  const tenantDir = getTenantDir(options.businessSlug);
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
    // Pre-deploy: ensure Linux user + Docker image
    // -----------------------------------------------------------------------
    log("[ssh] Pre-deploy: Ensuring business user and Docker image");
    await ensureBusinessUser(options.businessSlug, options.sshConfig, log);
    await ensureAgentImage(options.sshConfig, log);

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
      slackBotToken: options.slackBotToken,
      slackAppToken: options.slackAppToken,
      slackTeamId: options.slackTeamId,
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
    log("[ssh] CEO container healthy — CEO will self-deploy sub-agents from TEAM_PLAN.md");

    // -----------------------------------------------------------------------
    // Phase C: Done — CEO handles the rest
    // -----------------------------------------------------------------------
    // The CEO reads TEAM_PLAN.md from its workspace and deploys sub-agents
    // autonomously using the Docker socket. No further SSH commands needed.

    return { success: true, agentResults };
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
  const tenantDir = getTenantDir(businessSlug);
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
  slackBotToken?: string;
  slackAppToken?: string;
  slackTeamId?: string;
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
  const dockerParts = [
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
    // Mount workspace, config, memory
    `-v ${tenantDir}/workspace/workspace-${vpsAgentId}:/workspace:rw`,
    `-v ${tenantDir}/config:/config:ro`,
    `-v ${tenantDir}/memory/${vpsAgentId}:/memory:rw`,
    // Mount OAuth auth profiles from business user's home (read-only)
    `-v /home/${businessSlug}/.openclaw:/root/.openclaw:ro`,
    // Mount Docker socket so CEO can deploy sub-agents
    `-v /var/run/docker.sock:/var/run/docker.sock`,
    // Mount tenant dir so CEO can create workspace dirs for sub-agents
    `-v ${tenantDir}:${tenantDir}:rw`,
    `-p ${hostPort}:${CONTAINER_PORT}`,
    `--memory=512m`,
    `--cpus=0.5`,
    `--restart=unless-stopped`,
  ];

  // Add Slack tokens if provided
  if (opts.slackBotToken) {
    dockerParts.push(`-e SLACK_BOT_TOKEN=${opts.slackBotToken}`);
  }
  if (opts.slackAppToken) {
    dockerParts.push(`-e SLACK_APP_TOKEN=${opts.slackAppToken}`);
  }
  if (opts.slackTeamId) {
    dockerParts.push(`-e SLACK_TEAM_ID=${opts.slackTeamId}`);
  }

  dockerParts.push(image);
  const dockerCmd = dockerParts.join(" ");

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
