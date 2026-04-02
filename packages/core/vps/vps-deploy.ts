/**
 * VPS deployment push service.
 *
 * Routes deployments through SSH to Docker containers on the VPS.
 * Each agent gets its own container with OpenClaw gateway.
 * CEO deploys first, committed as template, then department heads spawn from it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAgentHealth, updateAgentVpsStatus } from "./vps-health";
import type { VpsConfig } from "./vps-config";
import type {
  VpsDeployPayload,
  VpsDeployResult,
  VpsAgentHealthStatus,
} from "./vps-types";
import {
  sshDeployBusiness,
  sshDeployAgent,
  type SshDeployOptions,
  type SshDeployAgent,
  type SshDeployResult,
} from "./ssh-deploy";
import { getSshConfig, type SshConfig } from "./ssh-client";

/**
 * Push a full deployment package to the VPS via SSH + Docker.
 *
 * 1. Converts VpsDeployPayload into SshDeployOptions
 * 2. Calls sshDeployBusiness() for Docker CEO-first deployment
 * 3. Updates agent_vps_status for each agent
 */
export async function pushDeploymentToVps(
  supabase: SupabaseClient,
  deploymentId: string,
  payload: VpsDeployPayload,
  vpsConfig?: VpsConfig,
  overrideSshConfig?: SshConfig,
): Promise<VpsDeployResult> {
  try {
    // Resolve SSH config: explicit override > global env
    let sshConfig: SshConfig | undefined = overrideSshConfig;
    if (!sshConfig) {
      try {
        sshConfig = getSshConfig();
      } catch {
        // getSshConfig() throws if not configured — let sshDeployBusiness handle it
      }
    }

    // Convert payload agents to SSH deploy agent format
    const sshAgents: SshDeployAgent[] = payload.agents.map((a) => ({
      agentId: a.agentId,
      vpsAgentId: a.vpsAgentId,
      departmentType: a.departmentType,
      model: a.model,
      isCeo: a.departmentType === "executive",
      templateName: a.vpsAgentId,
    }));

    const sshOptions: SshDeployOptions = {
      businessId: payload.businessId,
      businessSlug: payload.businessSlug,
      deploymentId,
      agents: sshAgents,
      workspaceFiles: payload.workspaceFiles,
      openclawConfig: payload.openclawConfig,
      sshConfig,
      anthropicApiKey: payload.anthropicApiKey,
    };

    const result = await sshDeployBusiness(supabase, sshOptions);

    return {
      success: result.success,
      deployId: deploymentId,
      agentResults: result.agentResults.map((r) => ({
        agentId: r.agentId,
        vpsAgentId: r.vpsAgentId,
        status: r.status,
        error: r.error,
      })),
      error: result.error,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      deployId: deploymentId,
      agentResults: [],
      error: errorMsg,
    };
  }
}

/**
 * Push a single agent to the VPS for per-agent deployment (hot-add).
 */
export async function pushAgentToVps(
  supabase: SupabaseClient,
  businessId: string,
  agentId: string,
  businessSlug: string,
  vpsAgentId: string,
  departmentType: string,
  model: string,
  workspaceFiles: Array<{ path: string; content: string }>,
  openclawConfig: string,
  anthropicApiKey?: string,
): Promise<VpsDeployResult> {
  try {
    let sshConfig: SshConfig | undefined;
    try {
      sshConfig = getSshConfig();
    } catch {
      // not configured
    }

    const agent: SshDeployAgent = {
      agentId,
      vpsAgentId,
      departmentType,
      model,
      isCeo: departmentType === "executive",
      templateName: vpsAgentId,
    };

    const result = await sshDeployAgent(
      supabase,
      businessSlug,
      businessId,
      agent,
      workspaceFiles,
      undefined,
      { sshConfig, anthropicApiKey },
    );

    return {
      success: result.success,
      deployId: "",
      agentResults: result.agentResults.map((r) => ({
        agentId: r.agentId,
        vpsAgentId: r.vpsAgentId,
        status: r.status,
        error: r.error,
      })),
      error: result.error,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      deployId: "",
      agentResults: [],
      error: errorMsg,
    };
  }
}

/**
 * Push a rollback deployment to the VPS.
 * Same as pushDeploymentToVps but with rollback metadata.
 */
export async function pushRollbackToVps(
  supabase: SupabaseClient,
  deploymentId: string,
  businessId: string,
  businessSlug: string,
  version: number,
  agents: Array<{
    agentId: string;
    vpsAgentId: string;
    departmentType: string;
    model: string;
  }>,
  storedWorkspaceFiles: Array<{ path: string; content: string }>,
  openclawConfig: string,
  vpsConfig?: VpsConfig,
  overrideSshConfig?: SshConfig,
  anthropicApiKey?: string,
): Promise<VpsDeployResult> {
  const payload: VpsDeployPayload = {
    businessId,
    businessSlug,
    deploymentId,
    version,
    isRollback: true,
    skipOptimization: true,
    agents,
    workspaceFiles: storedWorkspaceFiles,
    openclawConfig,
    anthropicApiKey,
  };

  return pushDeploymentToVps(supabase, deploymentId, payload, vpsConfig, overrideSshConfig);
}

/**
 * Run post-deploy health checks on all agents via VPS.
 */
export async function runPostDeployHealthCheck(
  supabase: SupabaseClient,
  businessId: string,
  agents: Array<{
    id: string;
    vpsAgentId: string;
  }>,
): Promise<{ healthy: string[]; unhealthy: string[] }> {
  const healthy: string[] = [];
  const unhealthy: string[] = [];

  for (const agent of agents) {
    const healthResult: VpsAgentHealthStatus | { vpsAgentId: string; status: "error"; metadata: { error: string } } =
      await checkAgentHealth(agent.vpsAgentId);

    if (healthResult.status === "running") {
      healthy.push(agent.id);
      await updateAgentVpsStatus(supabase, businessId, agent.id, agent.vpsAgentId, "running");
    } else {
      unhealthy.push(agent.id);
      await updateAgentVpsStatus(supabase, businessId, agent.id, agent.vpsAgentId, healthResult.status);
    }
  }

  return { healthy, unhealthy };
}
