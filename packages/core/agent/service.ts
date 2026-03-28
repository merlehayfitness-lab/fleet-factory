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
