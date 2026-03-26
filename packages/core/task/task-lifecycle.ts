import type { TaskStatus } from "../types/index";

/**
 * Task lifecycle state machine.
 *
 * Defines all valid status transitions for tasks.
 * Every transition must be explicitly allowed here -- unlisted transitions are rejected.
 *
 * Flow: queued -> assigned -> in_progress -> completed | failed
 * Approval: in_progress -> waiting_approval -> in_progress | failed
 * Assistance: in_progress -> assistance_requested -> in_progress | failed
 * Retry: failed -> queued
 * Terminal states: completed (no outgoing transitions)
 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ["assigned"],
  assigned: ["in_progress", "failed"],
  in_progress: [
    "waiting_approval",
    "assistance_requested",
    "completed",
    "failed",
  ],
  waiting_approval: ["in_progress", "failed"],
  assistance_requested: ["in_progress", "failed"],
  completed: [],
  failed: ["queued"],
};

/**
 * Check whether a task status transition is allowed.
 */
export function canTransitionTask(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

/**
 * Assert that a task status transition is valid.
 * Throws a descriptive error if the transition is not allowed.
 */
export function assertTaskTransition(
  from: TaskStatus,
  to: TaskStatus,
): void {
  if (!canTransitionTask(from, to)) {
    const allowed = TASK_TRANSITIONS[from];
    const allowedStr =
      allowed.length > 0 ? allowed.join(", ") : "none (terminal state)";
    throw new Error(
      `Invalid task transition: ${from} -> ${to}. Allowed from '${from}': ${allowedStr}`,
    );
  }
}

/**
 * Get the list of valid next states from a given task status.
 */
export function getValidTaskTransitions(
  from: TaskStatus,
): TaskStatus[] {
  return TASK_TRANSITIONS[from];
}
