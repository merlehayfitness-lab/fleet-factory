/**
 * Derive a deterministic vpsAgentId from business/agent metadata.
 * Format: {businessSlug}-{departmentType}-{agentIdPrefix}
 * where agentIdPrefix = first 8 chars of the agent UUID (hyphens stripped).
 *
 * IMPORTANT: This is the single source of truth for the naming convention.
 * Used by:
 *   - packages/runtime/generators/openclaw-config.ts (workspace generation)
 *   - packages/core/vps/vps-chat.ts (fallback agent ID lookup)
 *   - infra/vps/api-routes.ts (filesystem paths -- documents same convention)
 */
export function deriveVpsAgentId(
  businessSlug: string,
  departmentType: string,
  agentId: string,
): string {
  const prefix = agentId.replace(/-/g, "").slice(0, 8);
  return `${businessSlug}-${departmentType}-${prefix}`;
}

/**
 * Parse a vpsAgentId back into its components.
 * Format: {businessSlug}-{departmentType}-{agentIdPrefix}
 *
 * The agentIdPrefix is always exactly 8 alphanumeric chars (from UUID).
 * The departmentType is always a single word (no hyphens).
 * The businessSlug can contain hyphens.
 *
 * Returns null if the ID doesn't match the expected format.
 */
export function parseVpsAgentId(vpsAgentId: string): {
  businessSlug: string;
  departmentType: string;
  agentIdPrefix: string;
} | null {
  const parts = vpsAgentId.split("-");
  // Need at least 3 parts: slug (1+), dept (1), prefix (1)
  if (parts.length < 3) return null;

  const agentIdPrefix = parts[parts.length - 1];
  const departmentType = parts[parts.length - 2];
  const businessSlug = parts.slice(0, -2).join("-");

  // Validate prefix is 8 alphanumeric chars
  if (!/^[a-f0-9]{8}$/i.test(agentIdPrefix)) return null;
  if (!businessSlug || !departmentType) return null;

  return { businessSlug, departmentType, agentIdPrefix };
}
