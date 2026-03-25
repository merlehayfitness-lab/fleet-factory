import type { DeploymentStatus } from "../types/index";

/**
 * Deployment lifecycle state machine.
 *
 * Defines all valid status transitions for deployments.
 * Every transition must be explicitly allowed here -- unlisted transitions are rejected.
 *
 * Flow: queued -> building -> deploying -> live | failed
 * Recovery: failed -> queued (retry creates new record)
 * Rollback: live -> rolled_back
 * Terminal states: rolled_back (no outgoing transitions)
 */
export const DEPLOYMENT_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  queued: ["building"],
  building: ["deploying", "failed"],
  deploying: ["live", "failed"],
  live: ["rolled_back"],
  failed: ["queued"], // retry creates new record, but failed can transition to queued conceptually
  rolled_back: [], // terminal for this deployment record
};

/**
 * Check whether a deployment status transition is allowed.
 */
export function canTransitionDeployment(
  from: DeploymentStatus,
  to: DeploymentStatus,
): boolean {
  return DEPLOYMENT_TRANSITIONS[from].includes(to);
}

/**
 * Assert that a deployment status transition is valid.
 * Throws a descriptive error if the transition is not allowed.
 */
export function assertDeploymentTransition(
  from: DeploymentStatus,
  to: DeploymentStatus,
): void {
  if (!canTransitionDeployment(from, to)) {
    const allowed = DEPLOYMENT_TRANSITIONS[from];
    const allowedStr =
      allowed.length > 0 ? allowed.join(", ") : "none (terminal state)";
    throw new Error(
      `Invalid deployment transition: ${from} -> ${to}. Allowed transitions from '${from}': ${allowedStr}`,
    );
  }
}

/**
 * Get the list of valid next states from a given deployment status.
 */
export function getValidDeploymentTransitions(
  from: DeploymentStatus,
): DeploymentStatus[] {
  return DEPLOYMENT_TRANSITIONS[from];
}
