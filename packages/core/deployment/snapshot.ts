/**
 * Config snapshot creation and restoration for versioned deployment rollbacks.
 *
 * A ConfigSnapshot captures the complete state of all agents, departments,
 * and integrations at deploy time. This enables rollback to any previous
 * deployment by restoring from its snapshot.
 */

export interface SnapshotAgent {
  id: string;
  name: string;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
  department_id: string;
  status: string;
}

export interface ConfigSnapshot {
  version: number;
  business: { id: string; name: string; slug: string };
  agents: SnapshotAgent[];
  departments: Array<{ id: string; name: string; type: string }>;
  integrations: Array<{
    id: string;
    agent_id: string | null;
    type: string;
    provider: string;
    status: string;
  }>;
  generated_at: string;
  artifacts?: {
    tenant_config: string;
    docker_compose: string;
    env_file: string;
    agent_configs: Array<{ agent_id: string; filename: string; content: string }>;
  };
  openclaw_workspace?: {
    files: Array<{ path: string; content: string }>;
    config: string;
  };
}

/**
 * Assemble a config snapshot from the provided data.
 * This captures the full state of all tenant resources at deploy time.
 */
export function createConfigSnapshot(
  version: number,
  business: { id: string; name: string; slug: string },
  agents: SnapshotAgent[],
  departments: Array<{ id: string; name: string; type: string }>,
  integrations: Array<{
    id: string;
    agent_id: string | null;
    type: string;
    provider: string;
    status: string;
  }>,
): ConfigSnapshot {
  return {
    version,
    business,
    agents,
    departments,
    integrations,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Extract restorable data from a snapshot.
 * Used by rollback to know what state to restore.
 */
export function restoreFromSnapshot(snapshot: ConfigSnapshot): {
  agents: SnapshotAgent[];
  departments: Array<{ id: string; name: string; type: string }>;
  integrations: Array<{
    id: string;
    agent_id: string | null;
    type: string;
    provider: string;
    status: string;
  }>;
} {
  return {
    agents: snapshot.agents,
    departments: snapshot.departments,
    integrations: snapshot.integrations,
  };
}
