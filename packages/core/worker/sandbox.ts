/**
 * Sandbox policy validation for agent tool execution.
 *
 * Enforces security boundaries: agents must never have host filesystem access,
 * elevated execution, unrestricted network, or service_role credentials.
 */

import { getToolsForDepartment } from "./tool-catalog";

/**
 * Capabilities that agents must NEVER have.
 * Any agent tool_profile requesting these is rejected.
 */
export const BLOCKED_CAPABILITIES = [
  "host_filesystem_read",
  "host_filesystem_write",
  "elevated_execution",
  "unrestricted_network",
  "service_role_access",
  "container_escape",
  "mount_host_volumes",
] as const;

export type BlockedCapability = (typeof BLOCKED_CAPABILITIES)[number];

interface SandboxValidation {
  valid: boolean;
  violations: string[];
}

/**
 * Validate that an agent's tool_profile does not request any blocked capabilities.
 *
 * Scans the tool_profile object for keys matching BLOCKED_CAPABILITIES.
 * Also checks nested `capabilities` array if present.
 */
export function validateSandbox(
  agentToolProfile: Record<string, unknown>,
): SandboxValidation {
  const violations: string[] = [];

  // Check top-level keys
  for (const capability of BLOCKED_CAPABILITIES) {
    if (capability in agentToolProfile && agentToolProfile[capability]) {
      violations.push(capability);
    }
  }

  // Check nested capabilities array
  const capabilities = agentToolProfile.capabilities;
  if (Array.isArray(capabilities)) {
    for (const capability of BLOCKED_CAPABILITIES) {
      if (capabilities.includes(capability)) {
        violations.push(capability);
      }
    }
  }

  // Deduplicate
  const uniqueViolations = [...new Set(violations)];

  return {
    valid: uniqueViolations.length === 0,
    violations: uniqueViolations,
  };
}

/**
 * Validate that an agent is allowed to use a specific tool.
 *
 * Checks both:
 * 1. The department's tool catalog includes this tool
 * 2. The agent's tool_profile allows this tool (or has wildcard access)
 *
 * Returns true only if both conditions are met.
 */
export function validateToolAccess(
  toolName: string,
  agentToolProfile: Record<string, unknown>,
  departmentType: string,
): boolean {
  // 1. Check if tool exists in department catalog
  const departmentTools = getToolsForDepartment(departmentType);
  const toolInCatalog = departmentTools.some((t) => t.name === toolName);
  if (!toolInCatalog) {
    return false;
  }

  // 2. Check agent tool_profile allows this tool
  const allowedTools = agentToolProfile.allowed_tools;
  if (Array.isArray(allowedTools)) {
    // Wildcard: agent allowed all tools for its department
    if (allowedTools.includes("*")) {
      return true;
    }
    return allowedTools.includes(toolName);
  }

  // If no allowed_tools specified, check for department-level wildcard
  const departmentAccess = agentToolProfile.departments;
  if (
    typeof departmentAccess === "object" &&
    departmentAccess !== null &&
    !Array.isArray(departmentAccess)
  ) {
    const deptConfig = (departmentAccess as Record<string, unknown>)[departmentType];
    if (deptConfig === "*" || deptConfig === true) {
      return true;
    }
    if (Array.isArray(deptConfig)) {
      return (deptConfig as string[]).includes(toolName);
    }
  }

  // Default deny
  return false;
}

/**
 * Assert that an agent's sandbox is valid.
 * Throws a descriptive error listing all violations.
 */
export function assertSandbox(
  agentToolProfile: Record<string, unknown>,
): void {
  const result = validateSandbox(agentToolProfile);
  if (!result.valid) {
    throw new Error(
      `Sandbox violation: agent requests blocked capabilities: ${result.violations.join(", ")}. ` +
        `Agents must not have access to: ${BLOCKED_CAPABILITIES.join(", ")}`,
    );
  }
}
