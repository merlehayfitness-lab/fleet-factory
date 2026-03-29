/**
 * Generates openclaw.json configuration for a multi-agent OpenClaw workspace.
 * Returns stringified JSON.
 */

/**
 * Derive a deterministic vpsAgentId from business/agent metadata.
 * Format: {businessSlug}-{departmentType}-{agentIdPrefix}
 *
 * NOTE: This is a LOCAL COPY of the canonical implementation in
 * packages/core/vps/vps-naming.ts. Duplicated here to avoid circular
 * package dependency (core -> runtime -> core). Any changes to the
 * naming convention MUST be updated in BOTH locations.
 */
function deriveVpsAgentId(
  businessSlug: string,
  departmentType: string,
  agentId: string,
): string {
  const prefix = agentId.replace(/-/g, "").slice(0, 8);
  return `${businessSlug}-${departmentType}-${prefix}`;
}

interface AgentConfigInput {
  id: string;
  departmentType: string;
  name: string;
  modelProfile: Record<string, unknown>;
}

interface SandboxConfig {
  image?: string;
  memory?: string;
  cpus?: string;
  networkAccess?: boolean;
}

const DEFAULT_SANDBOX: SandboxConfig = {
  image: "openclaw-sandbox-common:latest",
  memory: "512m",
  cpus: "0.5",
  networkAccess: true,
};

export function generateOpenClawConfig(
  businessSlug: string,
  agents: AgentConfigInput[],
  sandboxConfig?: SandboxConfig,
): string {
  const sandbox = { ...DEFAULT_SANDBOX, ...sandboxConfig };

  const agentList = agents.map((agent) => {
    const vpsAgentId = deriveVpsAgentId(
      businessSlug,
      agent.departmentType,
      agent.id,
    );

    const model =
      (agent.modelProfile as { model?: string }).model || "claude-sonnet-4-6";

    return {
      id: vpsAgentId,
      name: agent.name,
      department: agent.departmentType,
      workspace: `workspace-${vpsAgentId}`,
      model,
      sandbox: {
        image: sandbox.image,
        memory: sandbox.memory,
        cpus: sandbox.cpus,
        network_access: sandbox.networkAccess,
      },
    };
  });

  // Build allow list for inter-agent messaging (all agents within this business)
  const allAgentIds = agentList.map((a) => a.id);

  const config = {
    version: "1.0",
    business: {
      slug: businessSlug,
    },
    agents: {
      list: agentList,
      communication: {
        enabled: true,
        scope: "business",
        protocol: "internal-message",
      },
    },
    tools: {
      agentToAgent: {
        enabled: true,
        allow: allAgentIds,
        capabilities: ["sessions_send", "sessions_list", "sessions_history"],
      },
    },
    runtime: {
      engine: "openclaw",
      sandbox: {
        default_image: sandbox.image,
        default_memory: sandbox.memory,
        default_cpus: sandbox.cpus,
        network_access: sandbox.networkAccess,
      },
    },
  };

  return JSON.stringify(config, null, 2);
}
