import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentStatus } from "../types/index";
import { assertTransition } from "./lifecycle";

/**
 * Transition an agent to a new lifecycle status.
 *
 * 1. Fetches the current agent status (scoped by business_id for tenant isolation)
 * 2. Validates the transition via the state machine
 * 3. Updates the agent status
 * 4. Creates an audit_log entry
 */
export async function transitionAgentStatus(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
  newStatus: AgentStatus,
): Promise<void> {
  // 1. Fetch current agent
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, status, name")
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !agent) {
    throw new Error(
      `Agent not found: ${fetchError?.message ?? "No agent with that ID in this business"}`,
    );
  }

  const previousStatus = agent.status as AgentStatus;

  // 2. Validate transition
  assertTransition(previousStatus, newStatus);

  // 3. Update status
  const { error: updateError } = await supabase
    .from("agents")
    .update({ status: newStatus })
    .eq("id", agentId)
    .eq("business_id", businessId);

  if (updateError) {
    throw new Error(`Failed to update agent status: ${updateError.message}`);
  }

  // 4. Audit log
  const { error: auditError } = await supabase.from("audit_logs").insert({
    business_id: businessId,
    action: `agent.${newStatus}`,
    entity_type: "agent",
    entity_id: agentId,
    metadata: {
      previous_status: previousStatus,
      new_status: newStatus,
      agent_name: agent.name,
    },
  });

  if (auditError) {
    // Log but don't fail the transition -- audit is secondary
    console.error("Failed to create audit log:", auditError.message);
  }
}

/**
 * Update an agent's configuration fields.
 *
 * Only updates fields that are provided (partial update).
 * Creates an audit_log entry for the change.
 */
export async function updateAgentConfig(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
  config: {
    system_prompt?: string;
    tool_profile?: Record<string, unknown>;
    model_profile?: Record<string, unknown>;
    role_definition?: Record<string, unknown>;
    skill_definition?: string;
    role?: string;
    parent_agent_id?: string | null;
  },
): Promise<void> {
  // 1. Verify agent exists and belongs to business
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, name")
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !agent) {
    throw new Error(
      `Agent not found: ${fetchError?.message ?? "No agent with that ID in this business"}`,
    );
  }

  // 2. Build update payload (only provided fields)
  const updatePayload: Record<string, unknown> = {};
  if (config.system_prompt !== undefined) {
    updatePayload.system_prompt = config.system_prompt;
  }
  if (config.tool_profile !== undefined) {
    updatePayload.tool_profile = config.tool_profile;
  }
  if (config.model_profile !== undefined) {
    updatePayload.model_profile = config.model_profile;
  }
  if (config.role_definition !== undefined) {
    updatePayload.role_definition = config.role_definition;
  }
  if (config.skill_definition !== undefined) {
    updatePayload.skill_definition = config.skill_definition;
  }
  if (config.role !== undefined) {
    updatePayload.role = config.role;
  }
  if (config.parent_agent_id !== undefined) {
    updatePayload.parent_agent_id = config.parent_agent_id;
  }

  if (Object.keys(updatePayload).length === 0) {
    return; // Nothing to update
  }

  // 3. Update
  const { error: updateError } = await supabase
    .from("agents")
    .update(updatePayload)
    .eq("id", agentId)
    .eq("business_id", businessId);

  if (updateError) {
    throw new Error(`Failed to update agent config: ${updateError.message}`);
  }

  // 4. Audit log
  const { error: auditError } = await supabase.from("audit_logs").insert({
    business_id: businessId,
    action: "agent.config_updated",
    entity_type: "agent",
    entity_id: agentId,
    metadata: {
      updated_fields: Object.keys(updatePayload),
      agent_name: agent.name,
    },
  });

  if (auditError) {
    console.error("Failed to create audit log:", auditError.message);
  }
}

/**
 * Get child agents for a parent agent (lead agent's sub-agents).
 */
export async function getChildAgents(
  supabase: SupabaseClient,
  parentAgentId: string,
  businessId: string,
): Promise<Array<{ id: string; name: string; status: string; role: string | null }>> {
  const { data, error } = await supabase
    .from("agents")
    .select("id, name, status, role")
    .eq("parent_agent_id", parentAgentId)
    .eq("business_id", businessId)
    .order("created_at");

  if (error) {
    throw new Error(`Failed to fetch child agents: ${error.message}`);
  }

  return (data ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    status: a.status as string,
    role: (a.role as string) ?? null,
  }));
}

/**
 * Get the parent agent for a sub-agent, if one exists.
 */
export async function getParentAgent(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
): Promise<{ id: string; name: string; status: string; role: string | null } | null> {
  // First fetch the agent to get its parent_agent_id
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("parent_agent_id")
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();

  if (agentError || !agent || !agent.parent_agent_id) {
    return null;
  }

  // Fetch the parent agent
  const { data: parent, error: parentError } = await supabase
    .from("agents")
    .select("id, name, status, role")
    .eq("id", agent.parent_agent_id as string)
    .eq("business_id", businessId)
    .single();

  if (parentError || !parent) {
    return null;
  }

  return {
    id: parent.id as string,
    name: parent.name as string,
    status: parent.status as string,
    role: (parent.role as string) ?? null,
  };
}

/**
 * Sync an agent's tool_profile and model_profile from its template.
 * Overwrites current agent values with the template's current values.
 * Returns the diff for UI confirmation.
 */
export async function syncFromTemplate(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
): Promise<{
  before: { tool_profile: Record<string, unknown>; model_profile: Record<string, unknown> };
  after: { tool_profile: Record<string, unknown>; model_profile: Record<string, unknown> };
}> {
  // 1. Fetch agent with template_id
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, template_id, tool_profile, model_profile")
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();
  if (agentErr || !agent) throw new Error("Agent not found");
  if (!agent.template_id) throw new Error("Agent has no linked template");

  // 2. Fetch template
  const { data: template, error: tmplErr } = await supabase
    .from("agent_templates")
    .select("tool_profile, model_profile")
    .eq("id", agent.template_id as string)
    .single();
  if (tmplErr || !template) throw new Error("Template not found");

  const before = {
    tool_profile: (agent.tool_profile as Record<string, unknown>) ?? {},
    model_profile: (agent.model_profile as Record<string, unknown>) ?? {},
  };
  const after = {
    tool_profile: (template.tool_profile as Record<string, unknown>) ?? {},
    model_profile: (template.model_profile as Record<string, unknown>) ?? {},
  };

  // 3. Update agent profiles
  const { error: updateErr } = await supabase
    .from("agents")
    .update({
      tool_profile: after.tool_profile,
      model_profile: after.model_profile,
    })
    .eq("id", agentId)
    .eq("business_id", businessId);
  if (updateErr) throw new Error(`Failed to sync: ${updateErr.message}`);

  // 4. Audit log (best effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      event_type: "agent.sync_from_template",
      entity_type: "agent",
      entity_id: agentId,
      metadata: { template_id: agent.template_id, changes: { before, after } },
    });
  } catch {
    console.error("Failed to log sync event (non-fatal)");
  }

  return { before, after };
}
