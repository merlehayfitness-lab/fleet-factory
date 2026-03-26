import type { ApprovalStatus } from "../types/index";

/**
 * Approval lifecycle state machine.
 *
 * Defines all valid status transitions for approvals.
 * Every transition must be explicitly allowed here -- unlisted transitions are rejected.
 *
 * Flow: pending -> approved | auto_approved | rejected
 * Two-step rejection:
 *   rejected -> retry_pending (first rejection -- agent auto-retries)
 *   rejected -> guidance_required (second rejection -- admin provides guidance)
 *   retry_pending -> pending (agent submits revised approach)
 *   guidance_required -> pending (admin provides guidance, agent retries)
 *
 * Terminal states: auto_approved, approved (no outgoing transitions)
 */
export const APPROVAL_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  pending: ["auto_approved", "approved", "rejected"],
  auto_approved: [], // terminal
  approved: [], // terminal
  rejected: ["retry_pending", "guidance_required"],
  retry_pending: ["pending"],
  guidance_required: ["pending"],
};

/**
 * Check whether an approval status transition is allowed.
 */
export function canTransitionApproval(
  from: ApprovalStatus,
  to: ApprovalStatus,
): boolean {
  return APPROVAL_TRANSITIONS[from].includes(to);
}

/**
 * Assert that an approval status transition is valid.
 * Throws a descriptive error if the transition is not allowed.
 */
export function assertApprovalTransition(
  from: ApprovalStatus,
  to: ApprovalStatus,
): void {
  if (!canTransitionApproval(from, to)) {
    const allowed = APPROVAL_TRANSITIONS[from];
    const allowedStr =
      allowed.length > 0 ? allowed.join(", ") : "none (terminal state)";
    throw new Error(
      `Invalid approval transition: ${from} -> ${to}. Allowed from '${from}': ${allowedStr}`,
    );
  }
}

/**
 * Get the list of valid next states from a given approval status.
 */
export function getValidApprovalTransitions(
  from: ApprovalStatus,
): ApprovalStatus[] {
  return APPROVAL_TRANSITIONS[from];
}
