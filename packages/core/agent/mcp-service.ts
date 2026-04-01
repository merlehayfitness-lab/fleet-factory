/**
 * MCP (Model Context Protocol) auto-assignment service.
 *
 * Reads mcp_servers from agent templates and generates MCP server
 * configurations for OpenClaw workspace artifacts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpServerDef {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface McpServerConfig {
  name: string;
  type: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  capabilities: string[];
}

// ---------------------------------------------------------------------------
// Known MCP server registry
// ---------------------------------------------------------------------------

const KNOWN_MCP_SERVERS: Record<string, {
  description: string;
  defaultUrl?: string;
  defaultCommand?: string;
  defaultArgs?: string[];
  capabilities: string[];
}> = {
  supabase: {
    description: "Supabase database access",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@modelcontextprotocol/server-supabase"],
    capabilities: ["query", "insert", "update", "rpc"],
  },
  slack: {
    description: "Slack messaging integration",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-slack"],
    capabilities: ["send_message", "read_channel", "list_channels"],
  },
  "google-analytics": {
    description: "Google Analytics data access",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-google-analytics"],
    capabilities: ["read_reports", "list_properties"],
  },
  cms: {
    description: "Content management system",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-cms"],
    capabilities: ["create_post", "update_post", "list_posts"],
  },
  "search-console": {
    description: "Google Search Console data",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-search-console"],
    capabilities: ["read_performance", "list_sitemaps"],
  },
  email: {
    description: "Email sending and management",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-email"],
    capabilities: ["send_email", "read_inbox", "create_draft"],
  },
  crm: {
    description: "CRM data access (Twenty CRM)",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-crm"],
    capabilities: ["read_contacts", "create_contact", "update_deal", "list_pipeline"],
  },
  "social-api": {
    description: "Social media platform APIs",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-social"],
    capabilities: ["create_post", "schedule_post", "read_analytics"],
  },
  "project-mgmt": {
    description: "Project management tools",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-project"],
    capabilities: ["create_task", "list_tasks", "update_status"],
  },
  calendar: {
    description: "Calendar management",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-calendar"],
    capabilities: ["create_event", "list_events", "check_availability"],
  },
  analytics: {
    description: "General analytics data",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-analytics"],
    capabilities: ["read_metrics", "create_report"],
  },
  helpdesk: {
    description: "Helpdesk / ticket system",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-helpdesk"],
    capabilities: ["create_ticket", "update_ticket", "list_tickets"],
  },
  "knowledge-base": {
    description: "Knowledge base search and management",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-knowledge"],
    capabilities: ["search", "create_article", "update_article"],
  },
  docs: {
    description: "Document generation and management",
    defaultCommand: "npx",
    defaultArgs: ["-y", "@anthropic/mcp-server-docs"],
    capabilities: ["create_document", "list_documents", "export_pdf"],
  },
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Resolve MCP server definitions from a template into full configs.
 * Merges template config with known server defaults.
 */
export function resolveMcpServers(serverDefs: McpServerDef[]): McpServerConfig[] {
  return serverDefs.map((def) => {
    const known = KNOWN_MCP_SERVERS[def.name];

    const config: McpServerConfig = {
      name: def.name,
      type: def.type,
      capabilities: known?.capabilities ?? [],
    };

    if (known?.defaultCommand) {
      config.command = known.defaultCommand;
      config.args = known.defaultArgs;
    }
    if (known?.defaultUrl) {
      config.url = known.defaultUrl;
    }

    // Apply scope restriction from template config
    const scope = def.config?.scope as string | undefined;
    if (scope && config.capabilities.length > 0) {
      config.capabilities = filterCapabilitiesByScope(config.capabilities, scope);
    }

    return config;
  });
}

/**
 * Get MCP servers for an agent from its template.
 */
export async function getMcpServersForAgent(
  supabase: SupabaseClient,
  agentId: string,
): Promise<McpServerConfig[]> {
  const { data: agent, error } = await supabase
    .from("agents")
    .select("template_id")
    .eq("id", agentId)
    .single();

  if (error || !agent?.template_id) return [];

  const { data: template } = await supabase
    .from("agent_templates")
    .select("mcp_servers")
    .eq("id", agent.template_id)
    .single();

  if (!template?.mcp_servers) return [];

  const serverDefs = template.mcp_servers as McpServerDef[];
  return resolveMcpServers(serverDefs);
}

/**
 * Generate MCP configuration block for an OpenClaw workspace.
 * Returns the JSON that goes into the workspace's mcp config.
 */
export function generateMcpWorkspaceConfig(servers: McpServerConfig[]): Record<string, unknown> {
  if (servers.length === 0) return { mcpServers: {} };

  const mcpServers: Record<string, unknown> = {};

  for (const server of servers) {
    mcpServers[server.name] = {
      ...(server.command ? { command: server.command, args: server.args ?? [] } : {}),
      ...(server.url ? { url: server.url } : {}),
      ...(server.env ? { env: server.env } : {}),
    };
  }

  return { mcpServers };
}

/**
 * List all known MCP servers.
 */
export function listKnownMcpServers(): Array<{ name: string; description: string; capabilities: string[] }> {
  return Object.entries(KNOWN_MCP_SERVERS).map(([name, info]) => ({
    name,
    description: info.description,
    capabilities: info.capabilities,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterCapabilitiesByScope(capabilities: string[], scope: string): string[] {
  const readPrefixes = ["read", "list", "search", "check", "get"];
  const writePrefixes = ["create", "update", "send", "schedule", "export"];

  switch (scope) {
    case "read":
      return capabilities.filter((c) =>
        readPrefixes.some((p) => c.startsWith(p)),
      );
    case "write":
      return capabilities; // write scope includes read
    case "admin":
      return capabilities; // admin gets everything
    default:
      return capabilities;
  }
}
