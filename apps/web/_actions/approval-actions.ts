"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ApprovalStatus, RiskLevel } from "@agency-factory/core";
import {
  getApprovalsForBusiness,
  getApprovalById,
  approveAction,
  rejectAction,
  provideGuidance,
  bulkApprove,
  bulkReject,
  executeTask,
} from "@agency-factory/core/server";

/**
 * Fetch approvals for a business with optional filters.
 */
export async function getApprovalsAction(
  businessId: string,
  filters?: { status?: ApprovalStatus; riskLevel?: RiskLevel },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const approvals = await getApprovalsForBusiness(
      supabase,
      businessId,
      filters,
    );
    return { approvals };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch approvals",
    };
  }
}

/**
 * Fetch a single approval by ID.
 */
export async function getApprovalAction(approvalId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const approval = await getApprovalById(supabase, approvalId);
    return { approval };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch approval",
    };
  }
}

/**
 * Approve a pending action.
 */
export async function approveActionHandler(
  approvalId: string,
  businessId: string,
  decisionNote?: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const approval = await approveAction(supabase, approvalId, user.id, decisionNote);

    // Re-execute the task now that approval has been granted
    if (approval?.task_id) {
      try {
        await executeTask(supabase, businessId, approval.task_id as string);
      } catch {
        // Non-blocking: task re-execution is best-effort
        console.error("Failed to re-execute task after approval");
      }
    }

    revalidatePath(`/businesses/${businessId}/approvals`);
    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to approve action",
    };
  }
}

/**
 * Reject a pending action.
 */
export async function rejectActionHandler(
  approvalId: string,
  businessId: string,
  decisionNote?: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await rejectAction(supabase, approvalId, user.id, decisionNote);
    revalidatePath(`/businesses/${businessId}/approvals`);
    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to reject action",
    };
  }
}

/**
 * Provide guidance for a guidance_required approval.
 */
export async function provideGuidanceAction(
  approvalId: string,
  businessId: string,
  guidance: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await provideGuidance(supabase, approvalId, user.id, guidance);
    revalidatePath(`/businesses/${businessId}/approvals`);
    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to provide guidance",
    };
  }
}

/**
 * Bulk approve multiple pending approvals.
 */
export async function bulkApproveAction(
  approvalIds: string[],
  businessId: string,
  decisionNote?: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const results = await bulkApprove(
      supabase,
      approvalIds,
      user.id,
      decisionNote,
    );
    revalidatePath(`/businesses/${businessId}/approvals`);
    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true, results };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to bulk approve",
    };
  }
}

/**
 * Bulk reject multiple pending approvals.
 */
export async function bulkRejectAction(
  approvalIds: string[],
  businessId: string,
  decisionNote?: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const results = await bulkReject(
      supabase,
      approvalIds,
      user.id,
      decisionNote,
    );
    revalidatePath(`/businesses/${businessId}/approvals`);
    revalidatePath(`/businesses/${businessId}/tasks`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true, results };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to bulk reject",
    };
  }
}
