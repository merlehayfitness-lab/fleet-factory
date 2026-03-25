import type { AgentStatus } from "../types/index";

/**
 * Agent lifecycle state machine.
 *
 * Defines all valid status transitions for agents. Every transition
 * must be explicitly allowed here -- unlisted transitions are rejected.
 *
 * Terminal state: retired (no outgoing transitions).
 */
export const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  provisioning: ["active", "error"],
  active: ["paused", "frozen", "error", "retired"],
  paused: ["active", "frozen", "retired"],
  frozen: ["active", "retired"],
  error: ["active", "retired"],
  retired: [],
};

/**
 * Check whether a status transition is allowed.
 */
export function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Assert that a status transition is valid. Throws a descriptive error
 * if the transition is not allowed.
 */
export function assertTransition(from: AgentStatus, to: AgentStatus): void {
  if (!canTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from];
    const allowedStr =
      allowed.length > 0 ? allowed.join(", ") : "none (terminal state)";
    throw new Error(
      `Invalid agent transition: ${from} -> ${to}. Allowed transitions from '${from}': ${allowedStr}`,
    );
  }
}

/**
 * Get the list of valid next states from a given status.
 */
export function getValidTransitions(from: AgentStatus): AgentStatus[] {
  return VALID_TRANSITIONS[from];
}
