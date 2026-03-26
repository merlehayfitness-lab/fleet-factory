import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalStatus, RiskLevel } from "../types/index";
import { assertApprovalTransition } from "./approval-lifecycle";

/**
 * Create an approval request.
 * Inserts with status 'pending' or 'auto_approved' based on shouldAutoApprove evaluation.
 */
export async function createApproval(
  supabase: SupabaseClient,
  businessId: string,
  taskId: string,
  agentId: string,
  actionType: string,
  actionSummary: string,
  riskLevel: RiskLevel,
  riskExplanation?: string,
  agentReasoning?: string,
  autoApproved = false,
) {
  const status: ApprovalStatus = autoApproved ? "auto_approved" : "pending";

  const { data: approval, error } = await supabase
    .from("approvals")
    .insert({
      business_id: businessId,
      task_id: taskId,
      agent_id: agentId,
      action_type: actionType,
      action_summary: actionSummary,
      risk_level: riskLevel,
      risk_explanation: riskExplanation ?? null,
      agent_reasoning: agentReasoning ?? null,
      status,
    })
    .select("*")
    .single();

  if (error || !approval) {
    throw new Error(
      `Failed to create approval: ${error?.message ?? "Unknown error"}`,
    );
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "approval.created",
      entity_type: "approval",
      entity_id: approval.id,
      metadata: {
        task_id: taskId,
        agent_id: agentId,
        action_type: actionType,
        risk_level: riskLevel,
        status,
      },
    });
  } catch {
    console.error("Failed to create approval audit log");
  }

  return approval;
}

/**
 * Fetch approvals for a business with optional filters.
 * Joins task title and agent name for display.
 */
export async function getApprovalsForBusiness(
  supabase: SupabaseClient,
  businessId: string,
  filters?: { status?: ApprovalStatus; riskLevel?: RiskLevel },
) {
  let query = supabase
    .from("approvals")
    .select("*, tasks:task_id(title), agents:agent_id(name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.riskLevel) {
    query = query.eq("risk_level", filters.riskLevel);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch approvals: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch a single approval by ID with task and agent info.
 */
export async function getApprovalById(
  supabase: SupabaseClient,
  approvalId: string,
) {
  const { data, error } = await supabase
    .from("approvals")
    .select("*, tasks:task_id(title), agents:agent_id(name)")
    .eq("id", approvalId)
    .single();

  if (error || !data) {
    throw new Error(
      `Approval not found: ${error?.message ?? "No approval with that ID"}`,
    );
  }

  return data;
}

/**
 * Approve a pending action.
 * Transitions approval pending -> approved and task back to in_progress.
 */
export async function approveAction(
  supabase: SupabaseClient,
  approvalId: string,
  decidedBy: string,
  decisionNote?: string,
) {
  // 1. Fetch current approval
  const { data: approval, error: fetchError } = await supabase
    .from("approvals")
    .select("id, status, task_id, business_id, action_type")
    .eq("id", approvalId)
    .single();

  if (fetchError || !approval) {
    throw new Error(
      `Approval not found: ${fetchError?.message ?? "No approval with that ID"}`,
    );
  }

  const currentStatus = approval.status as ApprovalStatus;

  // 2. Validate transition
  assertApprovalTransition(currentStatus, "approved");

  // 3. Update approval
  const { data: updated, error: updateError } = await supabase
    .from("approvals")
    .update({
      status: "approved",
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      decision_note: decisionNote ?? null,
    })
    .eq("id", approvalId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Failed to approve action: ${updateError.message}`);
  }

  // 4. Transition task back to in_progress
  try {
    await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", approval.task_id);
  } catch {
    console.error("Failed to transition task after approval");
  }

  // 5. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: approval.business_id,
      actor_id: decidedBy,
      action: "approval.approved",
      entity_type: "approval",
      entity_id: approvalId,
      metadata: {
        task_id: approval.task_id,
        action_type: approval.action_type,
        decision_note: decisionNote ?? null,
      },
    });
  } catch {
    console.error("Failed to create approval audit log");
  }

  return updated;
}

/**
 * Reject an approval with two-step escalation logic.
 *
 * First rejection (retry_count < 1): status -> rejected -> retry_pending, increment retry_count.
 * Second rejection (retry_count >= 1): status -> rejected -> guidance_required.
 */
export async function rejectAction(
  supabase: SupabaseClient,
  approvalId: string,
  decidedBy: string,
  decisionNote?: string,
) {
  // 1. Fetch current approval
  const { data: approval, error: fetchError } = await supabase
    .from("approvals")
    .select("id, status, task_id, business_id, action_type, retry_count")
    .eq("id", approvalId)
    .single();

  if (fetchError || !approval) {
    throw new Error(
      `Approval not found: ${fetchError?.message ?? "No approval with that ID"}`,
    );
  }

  const currentStatus = approval.status as ApprovalStatus;
  const retryCount = (approval.retry_count as number) ?? 0;

  // 2. Validate transition to rejected
  assertApprovalTransition(currentStatus, "rejected");

  // 3. Determine next status based on retry count
  const nextStatus: ApprovalStatus =
    retryCount < 1 ? "retry_pending" : "guidance_required";

  // 4. Update approval
  const { data: updated, error: updateError } = await supabase
    .from("approvals")
    .update({
      status: nextStatus,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      decision_note: decisionNote ?? null,
      retry_count: retryCount + 1,
    })
    .eq("id", approvalId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Failed to reject action: ${updateError.message}`);
  }

  // 5. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: approval.business_id,
      actor_id: decidedBy,
      action: "approval.rejected",
      entity_type: "approval",
      entity_id: approvalId,
      metadata: {
        task_id: approval.task_id,
        action_type: approval.action_type,
        decision_note: decisionNote ?? null,
        retry_count: retryCount + 1,
        next_status: nextStatus,
      },
    });
  } catch {
    console.error("Failed to create rejection audit log");
  }

  return updated;
}

/**
 * Provide guidance for a guidance_required approval.
 * Sets decision_note to guidance text and transitions back to pending for agent retry.
 */
export async function provideGuidance(
  supabase: SupabaseClient,
  approvalId: string,
  decidedBy: string,
  guidance: string,
) {
  // 1. Fetch current approval
  const { data: approval, error: fetchError } = await supabase
    .from("approvals")
    .select("id, status, task_id, business_id, action_type")
    .eq("id", approvalId)
    .single();

  if (fetchError || !approval) {
    throw new Error(
      `Approval not found: ${fetchError?.message ?? "No approval with that ID"}`,
    );
  }

  const currentStatus = approval.status as ApprovalStatus;

  // 2. Validate transition
  assertApprovalTransition(currentStatus, "pending");

  // 3. Update approval
  const { data: updated, error: updateError } = await supabase
    .from("approvals")
    .update({
      status: "pending",
      decision_note: guidance,
    })
    .eq("id", approvalId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Failed to provide guidance: ${updateError.message}`);
  }

  // 4. Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: approval.business_id,
      actor_id: decidedBy,
      action: "approval.guidance_provided",
      entity_type: "approval",
      entity_id: approvalId,
      metadata: {
        task_id: approval.task_id,
        action_type: approval.action_type,
        guidance,
      },
    });
  } catch {
    console.error("Failed to create guidance audit log");
  }

  return updated;
}

/**
 * Bulk approve multiple pending approvals.
 * Processes each approval individually for proper state machine validation.
 */
export async function bulkApprove(
  supabase: SupabaseClient,
  approvalIds: string[],
  decidedBy: string,
  decisionNote?: string,
) {
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const id of approvalIds) {
    try {
      await approveAction(supabase, id, decidedBy, decisionNote);
      results.push({ id, success: true });
    } catch (err) {
      results.push({
        id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Bulk reject multiple pending approvals.
 * Processes each approval individually for proper two-step rejection logic.
 */
export async function bulkReject(
  supabase: SupabaseClient,
  approvalIds: string[],
  decidedBy: string,
  decisionNote?: string,
) {
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const id of approvalIds) {
    try {
      await rejectAction(supabase, id, decidedBy, decisionNote);
      results.push({ id, success: true });
    } catch (err) {
      results.push({
        id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}
