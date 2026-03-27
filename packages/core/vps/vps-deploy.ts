/**
 * VPS deployment push service.
 *
 * Sends deployment packages to the VPS via REST API, handles partial failures,
 * stores optimization reports, and runs post-deploy health checks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { vpsPost } from "./vps-client";
import { checkAgentHealth, updateAgentVpsStatus } from "./vps-health";
import type {
  VpsDeployPayload,
  VpsDeployResult,
  VpsAgentHealthStatus,
} from "./vps-types";

/**
 * Push a full deployment package to the VPS.
 *
 * 1. POST payload to /api/deploy
 * 2. If VPS unreachable, return { success: false, error }
 * 3. On success, update agent_vps_status for each agent based on agentResults
 * 4. Return VpsDeployResult
 */
export async function pushDeploymentToVps(
  supabase: SupabaseClient,
  deploymentId: string,
  payload: VpsDeployPayload,
): Promise<VpsDeployResult> {
  const result = await vpsPost<VpsDeployResult>("/api/deploy", payload);

  if (!result.success) {
    return {
      success: false,
      deployId: "",
      agentResults: [],
      error: result.error ?? "VPS deployment failed",
    };
  }

  // Update agent_vps_status for each agent based on results
  if (result.agentResults && result.agentResults.length > 0) {
    for (const agentResult of result.agentResults) {
      const containerStatus = agentResult.status === "deployed" ? "running" : "error";
      await updateAgentVpsStatus(
        supabase,
        payload.businessId,
        agentResult.agentId,
        agentResult.vpsAgentId,
        containerStatus,
      );
    }
  }

  // Store optimization report in deployment record if present
  if (result.optimizationReport) {
    await supabase
      .from("deployments")
      .update({
        optimization_report: result.optimizationReport,
      })
      .eq("id", deploymentId);
  }

  return result;
}

/**
 * Push a single agent to the VPS for per-agent deployment.
 *
 * 1. Build a single-agent VpsDeployPayload
 * 2. POST to /api/deploy
 * 3. Update agent_vps_status for the single agent
 * 4. Return result
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
): Promise<VpsDeployResult> {
  const payload: VpsDeployPayload = {
    businessId,
    businessSlug,
    deploymentId: "", // per-agent deploy has no deployment record
    version: 0,
    isRollback: false,
    skipOptimization: false,
    agents: [{ agentId, vpsAgentId, departmentType, model }],
    workspaceFiles,
    openclawConfig,
  };

  const result = await vpsPost<VpsDeployResult>("/api/deploy", payload);

  if (!result.success) {
    return {
      success: false,
      deployId: "",
      agentResults: [],
      error: result.error ?? "VPS agent deployment failed",
    };
  }

  // Update agent_vps_status for this agent
  const agentResult = result.agentResults?.find((r) => r.agentId === agentId);
  if (agentResult) {
    const containerStatus = agentResult.status === "deployed" ? "running" : "error";
    await updateAgentVpsStatus(supabase, businessId, agentId, vpsAgentId, containerStatus);
  }

  return result;
}

/**
 * Push a rollback deployment to the VPS.
 *
 * 1. Build VpsDeployPayload with skipOptimization=true, isRollback=true
 * 2. POST to /api/deploy
 * 3. Since skipOptimization is true, Claude Code deploys files as-is (deterministic rollback)
 * 4. Return result
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
  };

  const result = await vpsPost<VpsDeployResult>("/api/deploy", payload);

  if (!result.success) {
    return {
      success: false,
      deployId: "",
      agentResults: [],
      error: result.error ?? "VPS rollback failed",
    };
  }

  // Update agent_vps_status for each agent
  if (result.agentResults && result.agentResults.length > 0) {
    for (const agentResult of result.agentResults) {
      const containerStatus = agentResult.status === "deployed" ? "running" : "error";
      await updateAgentVpsStatus(
        supabase,
        businessId,
        agentResult.agentId,
        agentResult.vpsAgentId,
        containerStatus,
      );
    }
  }

  return result;
}

/**
 * Run post-deploy health checks on all agents via VPS.
 *
 * 1. For each agent, call checkAgentHealth(vpsAgentId)
 * 2. Update agent_vps_status for each agent
 * 3. Return arrays of healthy and unhealthy agent IDs
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
