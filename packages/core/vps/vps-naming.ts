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
