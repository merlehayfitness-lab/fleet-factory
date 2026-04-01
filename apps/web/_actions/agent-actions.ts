"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { requireActiveBusiness } from "@/_lib/require-active-business";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  transitionAgentStatus,
  updateAgentConfig,
} from "@agency-factory/core";

/**
 * Freeze an agent (emergency stop). Transitions to 'frozen' status.
 */
export async function freezeAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    await transitionAgentStatus(supabase, agentId, businessId, "frozen");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to freeze agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Pause an agent. Transitions to 'paused' status.
 */
export async function pauseAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    await transitionAgentStatus(supabase, agentId, businessId, "paused");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to pause agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Resume an agent. Transitions to 'active' status.
 */
export async function resumeAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    await transitionAgentStatus(supabase, agentId, businessId, "active");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to resume agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Retire an agent permanently. Transitions to 'retired' (terminal) status.
 */
export async function retireAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    await transitionAgentStatus(supabase, agentId, businessId, "retired");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to retire agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Update an agent's configuration (system prompt, tool profile, model profile).
 */
export async function updateAgentConfigAction(
  agentId: string,
  businessId: string,
  config: {
    system_prompt?: string;
    tool_profile?: Record<string, unknown>;
    model_profile?: Record<string, unknown>;
  },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    await updateAgentConfig(supabase, agentId, businessId, config);
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to update agent config",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Get the diff between an agent's current profiles and its template's profiles.
 * Used by the Sync from Template dialog to show a preview of changes.
 */
export async function getTemplateDiffAction(
  agentId: string,
  businessId: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch agent with template_id
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, template_id, tool_profile, model_profile")
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();

  if (agentErr || !agent) {
    return { error: "Agent not found" };
  }

  if (!agent.template_id) {
    return { error: "Agent has no linked template" };
  }

  // Fetch template profiles
  const { data: template, error: tmplErr } = await supabase
    .from("agent_templates")
    .select("tool_profile, model_profile")
    .eq("id", agent.template_id as string)
    .single();

  if (tmplErr || !template) {
    return { error: "Template not found" };
  }

  const agentProfiles = {
    tool_profile: (agent.tool_profile as Record<string, unknown>) ?? {},
    model_profile: (agent.model_profile as Record<string, unknown>) ?? {},
  };
  const templateProfiles = {
    tool_profile: (template.tool_profile as Record<string, unknown>) ?? {},
    model_profile: (template.model_profile as Record<string, unknown>) ?? {},
  };

  const hasChanges =
    JSON.stringify(agentProfiles.tool_profile) !==
      JSON.stringify(templateProfiles.tool_profile) ||
    JSON.stringify(agentProfiles.model_profile) !==
      JSON.stringify(templateProfiles.model_profile);

  return {
    agent: agentProfiles,
    template: templateProfiles,
    hasChanges,
  };
}

/**
 * Sync an agent's profiles from its linked template.
 * Overwrites tool_profile and model_profile with template values.
 */
export async function syncFromTemplateAction(
  agentId: string,
  businessId: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    const { syncFromTemplate } = await import("@agency-factory/core/server");
    const { before, after } = await syncFromTemplate(
      supabase,
      agentId,
      businessId,
    );
    revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
    return { success: true, before, after };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to sync from template",
    };
  }
}

/**
 * Reparent an agent (move to a different parent or department).
 * Used by drag-and-drop in the agent tree view.
 */
export async function reparentAgentAction(
  agentId: string,
  businessId: string,
  newParentAgentId: string | null,
  newDepartmentId: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    const { reparentAgent } = await import("@agency-factory/core/server");
    await reparentAgent(
      supabase,
      agentId,
      businessId,
      newParentAgentId,
      newDepartmentId,
    );
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to reparent agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
}

/**
 * Test an MCP server connection by pinging its URL.
 * Advisory only -- result does not block saving.
 */
export async function testMcpConnectionAction(
  url: string,
  transport: string,
): Promise<{ reachable: boolean; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { reachable: false, error: "Not authenticated" };
  }

  const { validateMcpServerUrl } = await import(
    "@agency-factory/core/server"
  );
  return validateMcpServerUrl(url, transport);
}

/**
 * Update an agent's display name (persona name).
 * Validates length and updates agents.name in the database.
 */
export async function updateAgentNameAction(
  agentId: string,
  businessId: string,
  newName: string,
): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  const trimmed = newName.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return { error: "Name must be 2-50 characters" };
  }

  const { error } = await supabase
    .from("agents")
    .update({ name: trimmed })
    .eq("id", agentId)
    .eq("business_id", businessId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
  return {};
}
