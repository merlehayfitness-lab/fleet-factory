/**
 * Emergency action service for Agency Factory.
 *
 * Provides emergency operations (freeze, revoke tools, disable, restore)
 * with mandatory reason tracking and audit logging.
 *
 * Every function accepts a SupabaseClient as first arg, validates the action,
 * executes the change, and creates an audit_log entry with the reason.
 * Audit logging is best-effort (errors logged not thrown).
 */

import type { AgentStatus } from "../types/index";
import { assertTransition } from "../agent/lifecycle";
import { pauseTenantContainers, resumeTenantContainers } from "../vps/vps-lifecycle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/**
 * Freeze an agent with a mandatory reason (emergency stop).
 * Validates transition, updates status to 'frozen', and logs the action.
 */
export async function freezeAgentWithReason(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
  reason: string,
  actorId: string,
): Promise<void> {
  // 1. Fetch agent
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
  assertTransition(previousStatus, "frozen");

  // 3. Update status
  const { error: updateError } = await supabase
    .from("agents")
    .update({ status: "frozen" })
    .eq("id", agentId)
    .eq("business_id", businessId);

  if (updateError) {
    throw new Error(`Failed to freeze agent: ${updateError.message}`);
  }

  // 4. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "emergency.agent_frozen",
      entity_type: "agent",
      entity_id: agentId,
      actor_id: actorId,
      metadata: {
        reason,
        previous_status: previousStatus,
        agent_name: agent.name,
        actor_id: actorId,
      },
    });
  } catch (err) {
    console.error("Failed to create audit log for agent freeze:", err);
  }
}

/**
 * Revoke all tool access for an agent (emergency).
 * Backs up current tool_profile in metadata, then clears it.
 */
export async function revokeToolAccess(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
  reason: string,
  actorId: string,
): Promise<void> {
  // 1. Fetch agent
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, name, tool_profile")
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !agent) {
    throw new Error(
      `Agent not found: ${fetchError?.message ?? "No agent with that ID in this business"}`,
    );
  }

  const currentToolProfile = agent.tool_profile ?? {};
  const previousToolCount = Object.keys(currentToolProfile).length;

  // 2. Update tool_profile to empty (store backup in metadata field)
  const { error: updateError } = await supabase
    .from("agents")
    .update({
      tool_profile: {},
      model_profile: {
        ...(agent.model_profile ?? {}),
        _tool_backup: currentToolProfile,
      },
    })
    .eq("id", agentId)
    .eq("business_id", businessId);

  if (updateError) {
    throw new Error(`Failed to revoke tool access: ${updateError.message}`);
  }

  // 3. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "emergency.tools_revoked",
      entity_type: "agent",
      entity_id: agentId,
      actor_id: actorId,
      metadata: {
        reason,
        previous_tool_count: previousToolCount,
        agent_name: agent.name,
      },
    });
  } catch (err) {
    console.error("Failed to create audit log for tool revoke:", err);
  }
}

/**
 * Disable an agent permanently (emergency).
 * Transitions to 'retired' status.
 */
export async function disableAgent(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
  reason: string,
  actorId: string,
): Promise<void> {
  // 1. Fetch agent
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

  // 2. Validate transition to retired
  assertTransition(previousStatus, "retired");

  // 3. Update status
  const { error: updateError } = await supabase
    .from("agents")
    .update({ status: "retired" })
    .eq("id", agentId)
    .eq("business_id", businessId);

  if (updateError) {
    throw new Error(`Failed to disable agent: ${updateError.message}`);
  }

  // 4. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "emergency.agent_disabled",
      entity_type: "agent",
      entity_id: agentId,
      actor_id: actorId,
      metadata: {
        reason,
        previous_status: previousStatus,
        agent_name: agent.name,
      },
    });
  } catch (err) {
    console.error("Failed to create audit log for agent disable:", err);
  }
}

/**
 * Restore a frozen agent back to active status.
 * Only works on agents in 'frozen' status.
 */
export async function restoreAgent(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
  actorId: string,
): Promise<void> {
  // 1. Fetch agent
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

  if (agent.status !== "frozen") {
    throw new Error(
      `Agent must be in 'frozen' status to restore. Current status: ${agent.status}`,
    );
  }

  // 2. Validate transition
  assertTransition("frozen" as AgentStatus, "active");

  // 3. Update status
  const { error: updateError } = await supabase
    .from("agents")
    .update({ status: "active" })
    .eq("id", agentId)
    .eq("business_id", businessId);

  if (updateError) {
    throw new Error(`Failed to restore agent: ${updateError.message}`);
  }

  // 4. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "emergency.agent_restored",
      entity_type: "agent",
      entity_id: agentId,
      actor_id: actorId,
      metadata: {
        agent_name: agent.name,
      },
    });
  } catch (err) {
    console.error("Failed to create audit log for agent restore:", err);
  }
}

/**
 * Disable an entire tenant (business).
 * Sets business status to 'disabled' and freezes all non-retired agents.
 */
export async function disableTenant(
  supabase: SupabaseClient,
  businessId: string,
  reason: string,
  actorId: string,
): Promise<void> {
  // 1. Fetch business
  const { data: business, error: fetchError } = await supabase
    .from("businesses")
    .select("id, name, status")
    .eq("id", businessId)
    .single();

  if (fetchError || !business) {
    throw new Error(
      `Business not found: ${fetchError?.message ?? "No business with that ID"}`,
    );
  }

  // 2. Update business status to disabled
  const { error: updateError } = await supabase
    .from("businesses")
    .update({ status: "disabled" })
    .eq("id", businessId);

  if (updateError) {
    throw new Error(`Failed to disable tenant: ${updateError.message}`);
  }

  // 3. Fetch all non-retired agents
  const { data: agents } = await supabase
    .from("agents")
    .select("id, status, name")
    .eq("business_id", businessId)
    .neq("status", "retired");

  let agentsFrozenCount = 0;

  // 4. Freeze each eligible agent
  for (const agent of agents ?? []) {
    const status = agent.status as AgentStatus;
    // Only freeze agents that can transition to frozen
    if (status === "active" || status === "paused" || status === "error") {
      const { error } = await supabase
        .from("agents")
        .update({ status: "frozen" })
        .eq("id", agent.id)
        .eq("business_id", businessId);

      if (!error) {
        agentsFrozenCount++;
      }
    }
  }

  // 5. Stop VPS containers (best-effort)
  let vpsStoppedCount = 0;
  try {
    const { data: biz } = await supabase
      .from("businesses")
      .select("slug")
      .eq("id", businessId)
      .single();
    if (biz?.slug) {
      const stopResult = await pauseTenantContainers(businessId, biz.slug as string);
      if (!stopResult.success) {
        console.warn("VPS container stop failed (best-effort):", stopResult.error);
      }
      vpsStoppedCount = stopResult.stoppedCount ?? 0;
    }
  } catch (err) {
    console.warn("VPS container stop error (best-effort):", err);
  }

  // 6. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "emergency.tenant_disabled",
      entity_type: "business",
      entity_id: businessId,
      actor_id: actorId,
      metadata: {
        reason,
        agents_frozen_count: agentsFrozenCount,
        vps_stopped_count: vpsStoppedCount,
        vps_warning: vpsStoppedCount === 0 ? "VPS containers may still be running" : undefined,
        business_name: business.name,
      },
    });
  } catch (err) {
    console.error("Failed to create audit log for tenant disable:", err);
  }
}

/**
 * Restore a disabled tenant.
 * Sets business status back to 'active' but does NOT auto-unfreeze agents.
 * Admin must manually review and restore each agent.
 */
export async function restoreTenant(
  supabase: SupabaseClient,
  businessId: string,
  actorId: string,
): Promise<void> {
  // 1. Fetch business
  const { data: business, error: fetchError } = await supabase
    .from("businesses")
    .select("id, name, status")
    .eq("id", businessId)
    .single();

  if (fetchError || !business) {
    throw new Error(
      `Business not found: ${fetchError?.message ?? "No business with that ID"}`,
    );
  }

  if (business.status !== "disabled") {
    throw new Error(
      `Business must be in 'disabled' status to restore. Current status: ${business.status}`,
    );
  }

  // 2. Update business status to active
  const { error: updateError } = await supabase
    .from("businesses")
    .update({ status: "active" })
    .eq("id", businessId);

  if (updateError) {
    throw new Error(`Failed to restore tenant: ${updateError.message}`);
  }

  // 3. Resume VPS containers (best-effort)
  let vpsResumedCount = 0;
  try {
    const { data: biz } = await supabase
      .from("businesses")
      .select("slug")
      .eq("id", businessId)
      .single();
    if (biz?.slug) {
      const resumeResult = await resumeTenantContainers(businessId, biz.slug as string);
      if (!resumeResult.success) {
        console.warn("VPS container resume failed (best-effort):", resumeResult.error);
      }
      vpsResumedCount = resumeResult.resumedCount ?? 0;
    }
  } catch (err) {
    console.warn("VPS container resume error (best-effort):", err);
  }

  // 4. Do NOT auto-unfreeze agents -- admin must manually review

  // 5. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "emergency.tenant_restored",
      entity_type: "business",
      entity_id: businessId,
      actor_id: actorId,
      metadata: {
        business_name: business.name,
        vps_resumed_count: vpsResumedCount,
        note: "Agents remain frozen for manual review",
      },
    });
  } catch (err) {
    console.error("Failed to create audit log for tenant restore:", err);
  }
}
