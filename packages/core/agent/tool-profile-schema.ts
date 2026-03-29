/**
 * Tool profile type definitions, MCP server catalog, and department defaults.
 *
 * Defines the structured shape for agent tool_profile JSONB columns,
 * a catalog of known MCP servers, and per-department starter profiles.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface McpServerConfig {
  name: string;        // Human-friendly name: "GitHub"
  url: string;         // Server URL or command: "npx -y @modelcontextprotocol/server-github"
  transport: "stdio" | "http" | "sse";
  env?: Record<string, string>; // Environment variables for the server
  enabled: boolean;
}

export interface ToolProfileShape {
  allowed_tools: string[];           // Tool allowlist (["*"] for all)
  mcp_servers: McpServerConfig[];    // MCP server configurations
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default empty tool profile -- allows all tools, no MCP servers.
 */
export const EMPTY_TOOL_PROFILE: ToolProfileShape = {
  allowed_tools: ["*"],
  mcp_servers: [],
};

// ---------------------------------------------------------------------------
// Known MCP server catalog
// ---------------------------------------------------------------------------

export interface KnownMcpServer {
  name: string;
  description: string;
  transport: "stdio" | "http" | "sse";
  defaultUrl: string;
  category: "system" | "development" | "communication" | "data" | "search" | "custom";
  configFields: Array<{ key: string; label: string; type: "text" | "secret" }>;
}

/**
 * Catalog of known MCP servers for quick setup.
 */
export const KNOWN_MCP_SERVERS: KnownMcpServer[] = [
  {
    name: "Filesystem",
    description: "Read, write, and manage local files and directories",
    transport: "stdio",
    defaultUrl: "npx -y @modelcontextprotocol/server-filesystem",
    category: "system",
    configFields: [
      { key: "ALLOWED_DIRECTORIES", label: "Allowed Directories", type: "text" },
    ],
  },
  {
    name: "GitHub",
    description: "Access GitHub repositories, issues, pull requests, and actions",
    transport: "stdio",
    defaultUrl: "npx -y @modelcontextprotocol/server-github",
    category: "development",
    configFields: [
      { key: "GITHUB_TOKEN", label: "GitHub Personal Access Token", type: "secret" },
    ],
  },
  {
    name: "Slack",
    description: "Send and receive messages, manage channels, and search history",
    transport: "stdio",
    defaultUrl: "npx -y @modelcontextprotocol/server-slack",
    category: "communication",
    configFields: [
      { key: "SLACK_BOT_TOKEN", label: "Slack Bot Token", type: "secret" },
      { key: "SLACK_TEAM_ID", label: "Slack Team ID", type: "text" },
    ],
  },
  {
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    transport: "stdio",
    defaultUrl: "npx -y @modelcontextprotocol/server-postgres",
    category: "data",
    configFields: [
      { key: "POSTGRES_CONNECTION_STRING", label: "Connection String", type: "secret" },
    ],
  },
  {
    name: "Brave Search",
    description: "Search the web using Brave Search API",
    transport: "stdio",
    defaultUrl: "npx -y @modelcontextprotocol/server-brave-search",
    category: "search",
    configFields: [
      { key: "BRAVE_API_KEY", label: "Brave API Key", type: "secret" },
    ],
  },
  {
    name: "Custom HTTP",
    description: "Connect to a custom MCP server via HTTP",
    transport: "http",
    defaultUrl: "",
    category: "custom",
    configFields: [
      { key: "SERVER_URL", label: "Server URL", type: "text" },
      { key: "API_KEY", label: "API Key (optional)", type: "secret" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Department default tool profiles
// ---------------------------------------------------------------------------

/**
 * Per-department starter tool allowlists.
 * Each department gets a curated set of tools -- no MCP servers by default.
 */
export const DEPARTMENT_DEFAULT_TOOL_PROFILES: Record<string, ToolProfileShape> = {
  owner: {
    allowed_tools: ["review_dashboard", "generate_report", "update_business_settings"],
    mcp_servers: [],
  },
  sales: {
    allowed_tools: ["search_contacts", "draft_email", "send_email", "create_deal", "update_deal_stage"],
    mcp_servers: [],
  },
  support: {
    allowed_tools: ["search_tickets", "create_ticket", "respond_to_ticket", "close_ticket", "search_kb"],
    mcp_servers: [],
  },
  operations: {
    allowed_tools: ["check_system_status", "run_diagnostic", "update_config", "schedule_maintenance"],
    mcp_servers: [],
  },
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Soft-validate an MCP server URL.
 *
 * - For http/sse transports: attempts HEAD request with 5s timeout.
 * - For stdio: always returns reachable (local commands can't be validated remotely).
 */
export async function validateMcpServerUrl(
  url: string,
  transport: string,
): Promise<{ reachable: boolean; error?: string }> {
  if (transport === "stdio") {
    return { reachable: true };
  }

  if (!url) {
    return { reachable: false, error: "URL is required for HTTP/SSE transport" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok || response.status === 405) {
      // 405 = HEAD not allowed, but server is reachable
      return { reachable: true };
    }

    return {
      reachable: false,
      error: `Server responded with status ${response.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      reachable: false,
      error: message.includes("abort")
        ? "Connection timed out (5s)"
        : `Connection failed: ${message}`,
    };
  }
}
