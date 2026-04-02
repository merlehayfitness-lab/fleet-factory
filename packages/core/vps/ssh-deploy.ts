/**
 * SSH-based deployment service for V2.
 *
 * Deploys workspace files via SSH and registers agents in OpenClaw gateway.
 * No Docker containers — OpenClaw handles agent execution natively.
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
  /** @deprecated Ports are no longer used — OpenClaw handles agent execution natively. Kept for caller compat. */
  portRangeStart?: number;
  agents: SshDeployAgent[];
  workspaceFiles: Array<{ path: string; content: string }>;
  openclawConfig: string;
  onProgress?: SshProgressCallback;
  /** Override SSH config (for per-business VPS targets). Falls back to global env vars. */
  sshConfig?: SshConfig;
  /** npm packages to install globally for MCP servers (e.g. @modelcontextprotocol/server-filesystem) */
  mcpNpmPackages?: string[];
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
 * 2. Write OpenClaw config and provision config
 * 3. Execute provision-tenant.sh (registers agents in OpenClaw, restarts gateway)
 * 4. Verify agent workspaces and update statuses in database
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
    // 1. Create tenant directory structure
    log(`[ssh] Creating tenant directory: ${tenantDir}`);
    await execCommand(
      `mkdir -p "${tenantDir}/workspace" "${tenantDir}/memory" "${tenantDir}/config"`,
      { sshConfig: options.sshConfig },
    );

    // 2. Upload workspace files
    log(`[ssh] Uploading ${options.workspaceFiles.length} workspace files`);
    for (const file of options.workspaceFiles) {
      const remotePath = `${tenantDir}/workspace/${file.path}`;
      await writeRemoteFile(remotePath, file.content, options.sshConfig);
    }

    // 3. Install MCP npm packages globally (non-fatal — npx -y fallback at runtime)
    if (options.mcpNpmPackages && options.mcpNpmPackages.length > 0) {
      const pkgs = options.mcpNpmPackages.join(" ");
      log(`[ssh] Installing MCP packages: ${pkgs}`);
      const installResult = await execCommand(
        `npm install -g ${pkgs}`,
        {
          onStdout: (line) => log(`[npm] ${line}`),
          onStderr: (line) => log(`[npm:err] ${line}`),
          timeout: 120000,
          sshConfig: options.sshConfig,
        },
      );
      if (installResult.code !== 0) {
        log(`[ssh] MCP package install returned code ${installResult.code} (non-fatal, npx will download at runtime)`);
      }
    }

    // 4. Write OpenClaw config
    log("[ssh] Writing OpenClaw config");
    await writeRemoteFile(`${tenantDir}/config/openclaw.json`, options.openclawConfig, options.sshConfig);

    // 5. Write provision config (JSON consumed by provision-tenant.sh)
    const provisionConfig = buildProvisionConfig(options);
    await writeRemoteFile(
      `${tenantDir}/config/provision.json`,
      JSON.stringify(provisionConfig, null, 2),
      options.sshConfig,
    );

    // 6. Sort agents: CEO first, then the rest
    const sortedAgents = [...options.agents].sort((a, b) => {
      if (a.isCeo && !b.isCeo) return -1;
      if (!a.isCeo && b.isCeo) return 1;
      return 0;
    });

    const ceoAgent = sortedAgents.find((a) => a.isCeo);

    // 7. Execute provision-tenant.sh (registers agents in OpenClaw, no Docker)
    log("[ssh] Running provision-tenant.sh");
    const provisionResult = await execCommand(
      `bash /opt/agency-factory/provision-tenant.sh "${options.businessSlug}"`,
      {
        cwd: tenantDir,
        onStdout: (line) => log(`[provision] ${line}`),
        onStderr: (line) => log(`[provision:err] ${line}`),
        timeout: 120000,
        sshConfig: options.sshConfig,
      },
    );

    if (provisionResult.code !== 0) {
      log(`[ssh] Provisioning failed with code ${provisionResult.code}`);
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

    // 8. For sub-agents: copy from CEO workspace then overwrite identity files
    if (ceoAgent) {
      const ceoWorkspaceDir = `${tenantDir}/workspace/workspace-${ceoAgent.vpsAgentId}`;
      for (const agent of sortedAgents) {
        if (agent.isCeo) continue;
        const subWorkspaceDir = `${tenantDir}/workspace/workspace-${agent.vpsAgentId}`;
        log(`[ssh] Copying CEO workspace to ${agent.vpsAgentId}`);
        await execCommand(
          `cp -r "${ceoWorkspaceDir}/." "${subWorkspaceDir}/"`,
          { sshConfig: options.sshConfig },
        );
        // Overwrite only the identity-specific files from the uploaded workspace files
        const identityFiles = ["SOUL.md", "IDENTITY.md", "TOOLS.md", "SKILL.md"];
        for (const fname of identityFiles) {
          const uploadedFile = options.workspaceFiles.find(
            (f) => f.path === `workspace-${agent.vpsAgentId}/${fname}`,
          );
          if (uploadedFile) {
            await writeRemoteFile(`${subWorkspaceDir}/${fname}`, uploadedFile.content, options.sshConfig);
          }
        }
      }
    }

    // 9. Verify each agent workspace exists on disk
    log("[ssh] Verifying agent workspaces");
    for (const agent of sortedAgents) {
      const checkResult = await execCommand(
        `test -f "${tenantDir}/workspace/workspace-${agent.vpsAgentId}/IDENTITY.md" && echo "ready" || echo "not_found"`,
        { sshConfig: options.sshConfig },
      );

      const isReady = checkResult.stdout.trim() === "ready";

      agentResults.push({
        agentId: agent.agentId,
        vpsAgentId: agent.vpsAgentId,
        status: isReady ? "deployed" : "failed",
        error: isReady ? undefined : `Workspace not ready for ${agent.vpsAgentId}`,
      });

      await updateAgentVpsStatus(
        supabase,
        options.businessId,
        agent.agentId,
        agent.vpsAgentId,
        isReady ? "running" : "error",
      );

      if (isReady) {
        log(`[ssh] Agent ${agent.vpsAgentId} workspace ready`);
      } else {
        log(`[ssh] Agent ${agent.vpsAgentId} workspace not ready`);
      }
    }

    const allDeployed = agentResults.every((r) => r.status === "deployed");
    log(`[ssh] Deployment ${allDeployed ? "complete" : "partial"}: ${agentResults.filter((r) => r.status === "deployed").length}/${agentResults.length} agents registered`);

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
 * Uploads workspace files and restarts the OpenClaw gateway to pick up the new agent.
 */
export async function sshDeployAgent(
  supabase: SupabaseClient,
  businessSlug: string,
  businessId: string,
  agent: SshDeployAgent,
  workspaceFiles: Array<{ path: string; content: string }>,
  onProgress?: SshProgressCallback,
  options?: {
    /** Copy workspace from CEO before overwriting identity files */
    ceoVpsAgentId?: string;
    sshConfig?: SshConfig;
  },
): Promise<SshDeployResult> {
  if (!isSshConfigured(options?.sshConfig)) {
    return {
      success: false,
      agentResults: [],
      error: "SSH not configured",
    };
  }

  const log = onProgress ?? console.log;
  const tenantDir = `${TENANT_DATA_DIR}/${businessSlug}`;
  const subWorkspaceDir = `${tenantDir}/workspace/workspace-${agent.vpsAgentId}`;

  try {
    // If CEO workspace available and this is a sub-agent, copy then overwrite identity files
    if (options?.ceoVpsAgentId && !agent.isCeo) {
      const ceoWorkspaceDir = `${tenantDir}/workspace/workspace-${options.ceoVpsAgentId}`;
      log(`[ssh] Copying CEO workspace to ${agent.vpsAgentId}`);
      await execCommand(
        `cp -r "${ceoWorkspaceDir}/." "${subWorkspaceDir}/"`,
        { sshConfig: options.sshConfig },
      );
      // Overwrite only identity-specific files
      const identityFiles = ["SOUL.md", "IDENTITY.md", "TOOLS.md", "SKILL.md"];
      for (const fname of identityFiles) {
        const uploadedFile = workspaceFiles.find(
          (f) => f.path === `workspace-${agent.vpsAgentId}/${fname}`,
        );
        if (uploadedFile) {
          await writeRemoteFile(`${subWorkspaceDir}/${fname}`, uploadedFile.content, options.sshConfig);
        }
      }
    } else {
      // Full workspace upload (CEO or no copy source)
      log(`[ssh] Uploading workspace for ${agent.vpsAgentId}`);
      for (const file of workspaceFiles) {
        const remotePath = `${tenantDir}/workspace/${file.path}`;
        await writeRemoteFile(remotePath, file.content, options?.sshConfig);
      }
    }

    // Restart OpenClaw gateway to pick up the new agent workspace
    log(`[ssh] Restarting OpenClaw gateway to register ${agent.vpsAgentId}`);
    const restartResult = await execCommand(
      `systemctl --user restart openclaw-gateway`,
      {
        onStdout: (line) => log(`[gateway] ${line}`),
        onStderr: (line) => log(`[gateway:err] ${line}`),
        sshConfig: options?.sshConfig,
      },
    );

    // Verify workspace exists
    const checkResult = await execCommand(
      `test -f "${subWorkspaceDir}/IDENTITY.md" && echo "ready" || echo "not_found"`,
      { sshConfig: options?.sshConfig },
    );
    const success = checkResult.stdout.trim() === "ready" && restartResult.code === 0;

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
        error: success ? undefined : "Workspace not ready or gateway restart failed",
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
    deploymentId: options.deploymentId,
    agents: options.agents.map((a) => ({
      agentId: a.agentId,
      vpsAgentId: a.vpsAgentId,
      departmentType: a.departmentType,
      model: a.model,
      isCeo: a.isCeo,
      templateName: a.templateName,
      skillsPackage: a.skillsPackage ?? [],
      mcpServers: a.mcpServers ?? [],
      tokenBudget: a.tokenBudget ?? 100000,
    })),
  };
}
