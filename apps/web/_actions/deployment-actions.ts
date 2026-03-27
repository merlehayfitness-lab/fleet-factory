"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  triggerDeployment,
  retryDeployment,
  rollbackDeployment,
  getDeploymentHistory,
  pushAgentToVps,
  isVpsConfigured,
  generateOpenClawWorkspace,
} from "@agency-factory/core/server";
import { deriveVpsAgentId } from "@agency-factory/core";

/**
 * Trigger a new deployment for a business.
 * Orchestrates the full pipeline: fetch data, generate artifacts, transition to live.
 */
export async function deployAction(businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const deployment = await triggerDeployment(supabase, businessId, user.id);
    revalidatePath(`/businesses/${businessId}/deployments`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true, deploymentId: deployment?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Deployment failed" };
  }
}

/**
 * Retry a failed deployment by creating a fresh deployment from current state.
 */
export async function retryDeploymentAction(
  businessId: string,
  deploymentId: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const deployment = await retryDeployment(
      supabase,
      businessId,
      deploymentId,
      user.id,
    );
    revalidatePath(`/businesses/${businessId}/deployments`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true, deploymentId: deployment?.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Retry failed",
    };
  }
}

/**
 * Rollback to a previous deployment version.
 * Creates a new deployment from the target version's config snapshot.
 */
export async function rollbackDeploymentAction(
  businessId: string,
  targetVersion: number,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const deployment = await rollbackDeployment(
      supabase,
      businessId,
      targetVersion,
      user.id,
    );
    revalidatePath(`/businesses/${businessId}/deployments`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true, deploymentId: deployment?.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Rollback failed",
    };
  }
}

/**
 * Get deployment history for a business.
 */
export async function getDeploymentsAction(businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const deployments = await getDeploymentHistory(supabase, businessId);
    return { deployments };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch deployments",
    };
  }
}

/**
 * Get a single deployment's current status.
 * Used by the polling fallback when WebSocket is unavailable.
 */
export async function getDeploymentStatusAction(deploymentId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("deployments")
    .select("id, status, version, config_snapshot, created_at, updated_at")
    .eq("id", deploymentId)
    .single();

  if (error || !data) {
    return { error: "Deployment not found" };
  }

  return { deployment: data };
}

/**
 * Deploy a single agent to the VPS.
 * Generates workspace for just this agent and pushes to VPS.
 */
export async function deployAgentAction(businessId: string, agentId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!isVpsConfigured()) {
    return { error: "VPS is not configured. Set VPS_API_URL and VPS_API_KEY." };
  }

  try {
    // Fetch agent data
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, system_prompt, tool_profile, model_profile, department_id, status")
      .eq("id", agentId)
      .eq("business_id", businessId)
      .single();

    if (agentError || !agent) {
      return { error: "Agent not found" };
    }

    // Fetch business
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, name, slug, industry")
      .eq("id", businessId)
      .single();

    if (bizError || !business) {
      return { error: "Business not found" };
    }

    // Fetch department
    const { data: dept, error: deptError } = await supabase
      .from("departments")
      .select("id, name, type")
      .eq("id", agent.department_id)
      .single();

    if (deptError || !dept) {
      return { error: "Department not found" };
    }

    // Fetch integrations for this agent
    const { data: integrations } = await supabase
      .from("integrations")
      .select("type, provider, config, status")
      .eq("agent_id", agentId)
      .eq("business_id", businessId);

    const integrationsByAgent: Record<
      string,
      Array<{ type: string; provider: string; config?: Record<string, unknown>; status: string }>
    > = {};
    if (integrations && integrations.length > 0) {
      integrationsByAgent[agentId] = integrations.map((i) => ({
        type: i.type as string,
        provider: i.provider as string,
        config: (i.config as Record<string, unknown>) ?? undefined,
        status: i.status as string,
      }));
    }

    // Generate workspace for single agent
    const workspace = generateOpenClawWorkspace(
      {
        id: business.id,
        name: business.name,
        slug: business.slug,
        industry: (business.industry as string) ?? "general",
      },
      [
        {
          id: agent.id as string,
          name: agent.name as string,
          department_id: agent.department_id as string,
          system_prompt: (agent.system_prompt as string) ?? "",
          tool_profile: (agent.tool_profile as Record<string, unknown>) ?? {},
          model_profile: (agent.model_profile as Record<string, unknown>) ?? {},
          status: agent.status as string,
        },
      ],
      [{ id: dept.id as string, type: dept.type as string, name: dept.name as string }],
      integrationsByAgent,
    );

    const vpsAgentId = deriveVpsAgentId(business.slug, dept.type as string, agentId);
    const model = ((agent.model_profile as Record<string, unknown>)?.model as string) ?? "default";

    const result = await pushAgentToVps(
      supabase,
      businessId,
      agentId,
      business.slug,
      vpsAgentId,
      dept.type as string,
      model,
      workspace.files,
      workspace.config,
    );

    if (!result.success) {
      return { error: result.error ?? "Agent deployment failed" };
    }

    revalidatePath(`/businesses/${businessId}`);
    return { success: true, vpsAgentId };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Agent deployment failed",
    };
  }
}
