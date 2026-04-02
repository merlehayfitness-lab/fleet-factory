/**
 * Generates openclaw.json configuration for a multi-agent OpenClaw workspace.
 *
 * Produces a gateway-compatible config with:
 * - agents.list[] — all registered agents with workspace paths
 * - mcp.servers — MCP tool configs (filesystem per workspace, plus agent-specific)
 * - gateway.tools.allow — session tools for inter-agent comms + MCP
 * - gateway.http.endpoints — chat completions enabled
 *
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

interface McpServerEntry {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface SkillPackageEntry {
  name: string;
  source: string;
  version?: string;
}

interface AgentConfigInput {
  id: string;
  departmentType: string;
  name: string;
  modelProfile: Record<string, unknown>;
  mcpServers?: McpServerEntry[];
  skillsPackage?: SkillPackageEntry[];
  tokenBudget?: number;
  reportingChain?: string;
  roleLevel?: number;
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

/** Tenant data directory on VPS */
const TENANT_DATA_DIR = "/data/tenants";

export function generateOpenClawConfig(
  businessSlug: string,
  agents: AgentConfigInput[],
  sandboxConfig?: SandboxConfig,
  businessMcpServers?: McpServerEntry[],
): string {
  const sandbox = { ...DEFAULT_SANDBOX, ...sandboxConfig };
  const tenantDir = `${TENANT_DATA_DIR}/${businessSlug}`;

  // Build per-agent config and collect MCP servers
  const globalMcpServers: Record<string, Record<string, unknown>> = {};

  // Add business-level shared MCP servers (available to all agents)
  const sharedMcpServerNames: string[] = [];
  if (businessMcpServers) {
    for (const mcp of businessMcpServers) {
      const key = `shared-${mcp.name}`;
      globalMcpServers[key] = {
        ...(mcp.command ? { command: mcp.command, args: mcp.args ?? [] } : {}),
        ...(mcp.url ? { url: mcp.url } : {}),
        ...(mcp.env ? { env: mcp.env } : {}),
      };
      sharedMcpServerNames.push(key);
    }
  }

  const agentList = agents.map((agent) => {
    const vpsAgentId = deriveVpsAgentId(
      businessSlug,
      agent.departmentType,
      agent.id,
    );

    const model =
      (agent.modelProfile as { model?: string }).model || "claude-sonnet-4-6";

    const workspacePath = `${tenantDir}/workspace-${vpsAgentId}`;

    // Add filesystem MCP server scoped to this agent's workspace
    globalMcpServers[`filesystem-${vpsAgentId}`] = {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", workspacePath],
    };

    // Build agent-specific MCP servers and add to global pool
    const agentMcpServerNames: string[] = [
      `filesystem-${vpsAgentId}`,
      ...sharedMcpServerNames,
    ];
    if (agent.mcpServers) {
      for (const mcp of agent.mcpServers) {
        const serverKey = `${mcp.name}-${vpsAgentId}`;
        globalMcpServers[serverKey] = {
          ...(mcp.command ? { command: mcp.command, args: mcp.args ?? [] } : {}),
          ...(mcp.url ? { url: mcp.url } : {}),
          ...(mcp.env ? { env: mcp.env } : {}),
        };
        agentMcpServerNames.push(serverKey);
      }
    }

    return {
      id: vpsAgentId,
      name: agent.name,
      department: agent.departmentType,
      workspace: workspacePath,
      model: `anthropic/${model}`,
      sandbox: {
        image: sandbox.image,
        memory: sandbox.memory,
        cpus: sandbox.cpus,
        network_access: sandbox.networkAccess,
      },
      mcpServers: agentMcpServerNames,
      ...(agent.skillsPackage?.length ? { skills: agent.skillsPackage } : {}),
      ...(agent.tokenBudget ? { tokenBudget: agent.tokenBudget } : {}),
      ...(agent.reportingChain ? { reportingChain: agent.reportingChain } : {}),
      ...(agent.roleLevel !== undefined ? { roleLevel: agent.roleLevel } : {}),
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
    // MCP servers available to agents (gateway-level config)
    mcp: {
      servers: globalMcpServers,
    },
    // Gateway configuration
    gateway: {
      http: {
        endpoints: {
          chatCompletions: { enabled: true },
        },
      },
      tools: {
        allow: [
          "sessions_send",
          "sessions_list",
          "sessions_history",
          "sessions_spawn",
          "mcp_*",
        ],
      },
    },
    tools: {
      agentToAgent: {
        enabled: true,
        allow: allAgentIds,
        capabilities: [
          "sessions_send",
          "sessions_list",
          "sessions_history",
          "sessions_spawn",
        ],
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
