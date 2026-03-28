"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Fetch departments for a business with agent counts and lead-agent detection.
 */
export async function getDepartmentsWithAgentCountAction(
  businessId: string,
): Promise<
  | {
      departments: Array<{
        id: string;
        name: string;
        type: string;
        agentCount: number;
        hasLead: boolean;
      }>;
    }
  | { error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    // Fetch departments
    const { data: departments, error: deptError } = await supabase
      .from("departments")
      .select("id, name, type")
      .eq("business_id", businessId)
      .order("created_at");

    if (deptError) {
      return { error: deptError.message };
    }

    if (!departments || departments.length === 0) {
      return { departments: [] };
    }

    // Fetch agents grouped by department to get counts and lead detection
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, department_id, parent_agent_id")
      .eq("business_id", businessId);

    if (agentsError) {
      return { error: agentsError.message };
    }

    const agentsByDept = new Map<
      string,
      { count: number; hasLead: boolean }
    >();

    for (const agent of agents ?? []) {
      const deptId = agent.department_id as string;
      if (!agentsByDept.has(deptId)) {
        agentsByDept.set(deptId, { count: 0, hasLead: false });
      }
      const entry = agentsByDept.get(deptId)!;
      entry.count += 1;
      if (!agent.parent_agent_id) {
        entry.hasLead = true;
      }
    }

    const result = departments.map((dept) => {
      const info = agentsByDept.get(dept.id as string);
      return {
        id: dept.id as string,
        name: dept.name as string,
        type: dept.type as string,
        agentCount: info?.count ?? 0,
        hasLead: info?.hasLead ?? false,
      };
    });

    return { departments: result };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch departments",
    };
  }
}

/**
 * Create a provisional agent (status='provisioning') for the wizard flow.
 * The agent starts with minimal data and is filled in across wizard steps.
 */
export async function createProvisionalAgentAction(
  businessId: string,
  name: string,
  departmentId: string,
  role?: string,
  parentAgentId?: string | null,
): Promise<{ agent: { id: string } } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!name.trim()) {
    return { error: "Agent name is required" };
  }

  if (!departmentId) {
    return { error: "Department is required" };
  }

  try {
    // Auto-detect parent agent if not explicitly provided
    let effectiveParentAgentId = parentAgentId;
    if (!effectiveParentAgentId) {
      const { data: leadAgent } = await supabase
        .from("agents")
        .select("id")
        .eq("business_id", businessId)
        .eq("department_id", departmentId)
        .is("parent_agent_id", null)
        .neq("status", "provisioning")
        .limit(1)
        .maybeSingle();

      if (leadAgent) {
        effectiveParentAgentId = leadAgent.id as string;
      }
    }

    const insertPayload: Record<string, unknown> = {
      business_id: businessId,
      department_id: departmentId,
      name: name.trim(),
      status: "provisioning",
      system_prompt: "",
      tool_profile: {},
      model_profile: {},
    };

    if (role) {
      insertPayload.role = role;
    }

    if (effectiveParentAgentId) {
      insertPayload.parent_agent_id = effectiveParentAgentId;
    }

    const { data: agent, error: insertError } = await supabase
      .from("agents")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) {
      return { error: `Failed to create agent: ${insertError.message}` };
    }

    // Best-effort audit log
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "agent.provisioning",
      entity_type: "agent",
      entity_id: agent.id,
      metadata: { agent_name: name, department_id: departmentId },
    });

    return { agent: { id: agent.id as string } };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to create provisional agent",
    };
  }
}

/**
 * Finalize a provisional agent with all generated data.
 * Sets status='active' and saves system prompt, skill definition, and role definition.
 */
export async function finalizeAgentAction(
  agentId: string,
  businessId: string,
  systemPrompt: string,
  skillDefinition: string,
  roleDefinition: Record<string, unknown>,
  toolProfile?: Record<string, unknown>,
  modelProfile?: Record<string, unknown>,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const updatePayload: Record<string, unknown> = {
      status: "active",
      system_prompt: systemPrompt,
      skill_definition: skillDefinition,
      role_definition: roleDefinition,
    };

    if (toolProfile) {
      updatePayload.tool_profile = toolProfile;
    }

    if (modelProfile) {
      updatePayload.model_profile = modelProfile;
    }

    const { error: updateError } = await supabase
      .from("agents")
      .update(updatePayload)
      .eq("id", agentId)
      .eq("business_id", businessId);

    if (updateError) {
      return { error: `Failed to finalize agent: ${updateError.message}` };
    }

    // Best-effort audit log
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "agent.active",
      entity_type: "agent",
      entity_id: agentId,
      metadata: { previous_status: "provisioning", new_status: "active" },
    });

    revalidatePath(`/businesses/${businessId}/agents`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to finalize agent",
    };
  }
}

/**
 * Delete a provisional agent. Only allows deletion of agents with status='provisioning'.
 */
export async function deleteProvisionalAgentAction(
  agentId: string,
  businessId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    // Verify agent is in provisioning status
    const { data: agent, error: fetchError } = await supabase
      .from("agents")
      .select("id, status, name")
      .eq("id", agentId)
      .eq("business_id", businessId)
      .single();

    if (fetchError || !agent) {
      return { error: "Agent not found" };
    }

    if (agent.status !== "provisioning") {
      return {
        error: `Cannot delete agent with status '${agent.status}'. Only provisioning agents can be deleted.`,
      };
    }

    const { error: deleteError } = await supabase
      .from("agents")
      .delete()
      .eq("id", agentId)
      .eq("business_id", businessId);

    if (deleteError) {
      return { error: `Failed to delete agent: ${deleteError.message}` };
    }

    // Best-effort audit log
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "agent.deleted",
      entity_type: "agent",
      entity_id: agentId,
      metadata: { agent_name: agent.name, was_provisional: true },
    });

    revalidatePath(`/businesses/${businessId}/agents`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to delete provisional agent",
    };
  }
}
