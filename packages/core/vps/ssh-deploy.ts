/**
 * SSH-based deployment service for V2.
 *
 * Replaces REST-based provisioning (pushDeploymentToVps) with SSH via node-ssh.
 * REST endpoints remain for runtime operations (chat, task, health).
 *
 * Deployment order: CEO agent deploys first, then sub-agents are hired.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  execCommand,
  writeRemoteFile,
  disconnect,
  isSshConfigured,
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
  portRangeStart: number;
  agents: SshDeployAgent[];
  workspaceFiles: Array<{ path: string; content: string }>;
  openclawConfig: string;
  onProgress?: SshProgressCallback;
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

// ---------------------------------------------------------------------------
// Main deployment function
// ---------------------------------------------------------------------------

/**
 * Deploy a full business to VPS via SSH.
 *
 * 1. Upload workspace files to tenant directory
 * 2. Write provision config
 * 3. Execute provision-tenant.sh (CEO first, then rest)
 * 4. Update agent statuses in database
 */
export async function sshDeployBusiness(
  supabase: SupabaseClient,
  options: SshDeployOptions,
): Promise<SshDeployResult> {
  if (!isSshConfigured()) {
    return {
      success: false,
      agentResults: [],
      error: "SSH not configured (VPS_SSH_HOST and VPS_SSH_KEY_PATH required)",
    };
  }

  const log = options.onProgress ?? console.log;
  const tenantDir = `${TENANT_DATA_DIR}/${options.businessSlug}`;
  const agentResults: SshDeployResult["agentResults"] = [];

  try {
    // 1. Create tenant directory structure
    log(`[ssh] Creating tenant directory: ${tenantDir}`);
    await execCommand(`mkdir -p "${tenantDir}/workspace" "${tenantDir}/memory" "${tenantDir}/config"`);

    // 2. Upload workspace files
    log(`[ssh] Uploading ${options.workspaceFiles.length} workspace files`);
    for (const file of options.workspaceFiles) {
      const remotePath = `${tenantDir}/workspace/${file.path}`;
      await writeRemoteFile(remotePath, file.content);
    }

    // 3. Write OpenClaw config
    log("[ssh] Writing OpenClaw config");
    await writeRemoteFile(`${tenantDir}/config/openclaw.json`, options.openclawConfig);

    // 4. Write provision config (JSON consumed by provision-tenant.sh)
    const provisionConfig = buildProvisionConfig(options);
    await writeRemoteFile(`${tenantDir}/config/provision.json`, JSON.stringify(provisionConfig, null, 2));

    // 5. Sort agents: CEO first, then the rest
    const sortedAgents = [...options.agents].sort((a, b) => {
      if (a.isCeo && !b.isCeo) return -1;
      if (!a.isCeo && b.isCeo) return 1;
      return 0;
    });

    // 6. Execute provision-tenant.sh
    log("[ssh] Running provision-tenant.sh");
    const provisionResult = await execCommand(
      `bash /opt/agency-factory/provision-tenant.sh "${options.businessSlug}"`,
      {
        cwd: tenantDir,
        onStdout: (line) => log(`[provision] ${line}`),
        onStderr: (line) => log(`[provision:err] ${line}`),
        timeout: 120000,
      },
    );

    if (provisionResult.code !== 0) {
      log(`[ssh] Provisioning failed with code ${provisionResult.code}`);
      // Mark all agents as failed
      for (const agent of sortedAgents) {
        agentResults.push({
          agentId: agent.agentId,
          vpsAgentId: agent.vpsAgentId,
          status: "failed",
          error: provisionResult.stderr || "Provisioning script failed",
        });
        await updateAgentVpsStatus(
          supabase,
          options.businessId,
          agent.agentId,
          agent.vpsAgentId,
          "error",
        );
      }
      return { success: false, agentResults, error: provisionResult.stderr };
    }

    // 7. Verify each agent container is running
    log("[ssh] Verifying agent containers");
    for (let i = 0; i < sortedAgents.length; i++) {
      const agent = sortedAgents[i];
      const port = options.portRangeStart + i;

      const checkResult = await execCommand(
        `docker ps --filter "name=${agent.vpsAgentId}" --format "{{.Status}}" 2>/dev/null || echo "not_found"`,
      );

      const isRunning = checkResult.stdout.toLowerCase().includes("up");

      agentResults.push({
        agentId: agent.agentId,
        vpsAgentId: agent.vpsAgentId,
        status: isRunning ? "deployed" : "failed",
        port,
        error: isRunning ? undefined : `Container not running: ${checkResult.stdout.trim()}`,
      });

      await updateAgentVpsStatus(
        supabase,
        options.businessId,
        agent.agentId,
        agent.vpsAgentId,
        isRunning ? "running" : "error",
      );

      if (isRunning) {
        log(`[ssh] Agent ${agent.vpsAgentId} running on port ${port}`);
      } else {
        log(`[ssh] Agent ${agent.vpsAgentId} failed to start`);
      }
    }

    const allDeployed = agentResults.every((r) => r.status === "deployed");
    log(`[ssh] Deployment ${allDeployed ? "complete" : "partial"}: ${agentResults.filter((r) => r.status === "deployed").length}/${agentResults.length} agents running`);

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
 * Deploy a single agent to an existing tenant via SSH.
 * Used for CEO "hiring" sub-agents after initial deployment.
 */
export async function sshDeployAgent(
  supabase: SupabaseClient,
  businessSlug: string,
  businessId: string,
  agent: SshDeployAgent,
  port: number,
  workspaceFiles: Array<{ path: string; content: string }>,
  onProgress?: SshProgressCallback,
): Promise<SshDeployResult> {
  if (!isSshConfigured()) {
    return {
      success: false,
      agentResults: [],
      error: "SSH not configured",
    };
  }

  const log = onProgress ?? console.log;
  const tenantDir = `${TENANT_DATA_DIR}/${businessSlug}`;

  try {
    // Upload agent workspace files
    log(`[ssh] Uploading workspace for ${agent.vpsAgentId}`);
    for (const file of workspaceFiles) {
      const remotePath = `${tenantDir}/workspace/${file.path}`;
      await writeRemoteFile(remotePath, file.content);
    }

    // Start agent container
    log(`[ssh] Starting agent container ${agent.vpsAgentId} on port ${port}`);
    const startResult = await execCommand(
      `bash /opt/agency-factory/start-agent.sh "${businessSlug}" "${agent.vpsAgentId}" "${agent.departmentType}" "${port}"`,
      {
        onStdout: (line) => log(`[agent] ${line}`),
        onStderr: (line) => log(`[agent:err] ${line}`),
      },
    );

    const success = startResult.code === 0;

    if (success) {
      await updateAgentVpsStatus(supabase, businessId, agent.agentId, agent.vpsAgentId, "running");
    } else {
      await updateAgentVpsStatus(supabase, businessId, agent.agentId, agent.vpsAgentId, "error");
    }

    return {
      success,
      agentResults: [{
        agentId: agent.agentId,
        vpsAgentId: agent.vpsAgentId,
        status: success ? "deployed" : "failed",
        port,
        error: success ? undefined : startResult.stderr,
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
// Helpers
// ---------------------------------------------------------------------------

function buildProvisionConfig(options: SshDeployOptions) {
  return {
    businessId: options.businessId,
    businessSlug: options.businessSlug,
    subdomain: options.subdomain ?? null,
    portRangeStart: options.portRangeStart,
    deploymentId: options.deploymentId,
    agents: options.agents.map((a, i) => ({
      agentId: a.agentId,
      vpsAgentId: a.vpsAgentId,
      departmentType: a.departmentType,
      model: a.model,
      isCeo: a.isCeo,
      templateName: a.templateName,
      port: options.portRangeStart + i,
      skillsPackage: a.skillsPackage ?? [],
      mcpServers: a.mcpServers ?? [],
      tokenBudget: a.tokenBudget ?? 100000,
    })),
  };
}
