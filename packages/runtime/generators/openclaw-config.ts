/**
 * Generates openclaw.json configuration for a multi-agent OpenClaw workspace.
 *
 * Produces a gateway-compatible config strictly matching OpenClaw's schema:
 * - agents.list[] — registered agents (only valid fields: id, name, workspace, model, skills, tools)
 * - mcp.servers — MCP tool configs (filesystem per workspace, plus agent-specific)
 * - tools — global tool allow lists
 * - gateway — port, auth, http endpoints
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

export function generateOpenClawConfig(
  businessSlug: string,
  agents: AgentConfigInput[],
  _sandboxConfig?: unknown,
  businessMcpServers?: McpServerEntry[],
): string {
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

    // Inside the container, workspace is mounted at /workspace
    const workspacePath = "/workspace";

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

    // Only emit fields that OpenClaw's schema accepts for agents.list items:
    // id, name, workspace, model, skills (string[]), tools
    const entry: Record<string, unknown> = {
      id: vpsAgentId,
      name: agent.name,
      workspace: workspacePath,
      model: `anthropic/${model}`,
    };

    // Skills must be string[], not object[]
    if (agent.skillsPackage?.length) {
      entry.skills = agent.skillsPackage.map((s) => s.name);
    }

    // Per-agent tool config: allow MCP tools
    entry.tools = {
      profile: "full" as const,
      alsoAllow: agentMcpServerNames.map((n) => `mcp:${n}`),
    };

    return entry;
  });

  const config = {
    agents: {
      defaults: {
        model: "anthropic/claude-sonnet-4-6",
      },
      list: agentList,
    },
    mcp: {
      servers: globalMcpServers,
    },
    tools: {
      profile: "full" as const,
      alsoAllow: ["mcp_*"],
    },
    gateway: {
      port: 18789,
      mode: "local" as const,
      bind: "custom" as const,
      customBindHost: "0.0.0.0",
      auth: { mode: "password" as const },
      http: {
        endpoints: {
          chatCompletions: { enabled: true },
        },
      },
    },
  };

  return JSON.stringify(config, null, 2);
}
