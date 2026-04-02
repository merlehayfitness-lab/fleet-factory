/**
 * TypeScript type definitions for the AITMPL (aitmpl.com) catalog schema.
 *
 * These interfaces match the public JSON at https://www.aitmpl.com/components.json.
 * See 15-RESEARCH.md for schema details.
 */

// ---------------------------------------------------------------------------
// Component types
// ---------------------------------------------------------------------------

/** The 7 AITMPL component types. */
export type AitmplComponentType =
  | "skill"
  | "agent"
  | "command"
  | "mcp"
  | "setting"
  | "hook"
  | "plugin";

// ---------------------------------------------------------------------------
// Component schema (universal for skill, agent, command, mcp, setting, hook)
// ---------------------------------------------------------------------------

/** Security validation status for an AITMPL component. */
export interface AitmplSecurityInfo {
  validated: boolean;
  valid: boolean | null;
  score: number | null;
  errorCount: number;
  warningCount: number;
  lastValidated: string | null;
}

/** A single AITMPL component (skill, agent, command, mcp, setting, or hook). */
export interface AitmplComponent {
  name: string;
  path: string;
  category: string;
  type: string;
  content: string;
  description: string;
  author: string;
  repo: string;
  version: string;
  license: string;
  keywords: string[];
  downloads: number;
  security: AitmplSecurityInfo;
}

// ---------------------------------------------------------------------------
// Plugin schema (different shape from components)
// ---------------------------------------------------------------------------

/** An AITMPL plugin -- a bundle of agents, commands, and MCP servers. */
export interface AitmplPlugin {
  name: string;
  id: string;
  type: "plugin";
  description: string;
  version: string;
  keywords: string[];
  author: string;
  commands: number;
  agents: number;
  mcpServers: number;
  commandsList: string[];
  agentsList: string[];
  mcpServersList: string[];
  installCommand: string;
  downloads: number;
}

// ---------------------------------------------------------------------------
// Template schema (project scaffolds -- included for completeness)
// ---------------------------------------------------------------------------

/** An AITMPL template -- a project scaffold. */
export interface AitmplTemplate {
  name: string;
  id: string;
  type: "template";
  subtype: string;
  category: string;
  language: string;
  description: string;
  files: string[];
  installCommand: string;
  downloads: number;
}

// ---------------------------------------------------------------------------
// Full catalog shape
// ---------------------------------------------------------------------------

/** The full AITMPL catalog JSON structure. */
export interface AitmplCatalog {
  skills: AitmplComponent[];
  agents: AitmplComponent[];
  commands: AitmplComponent[];
  mcps: AitmplComponent[];
  settings: AitmplComponent[];
  hooks: AitmplComponent[];
  plugins: AitmplPlugin[];
  templates: AitmplTemplate[];
}

// ---------------------------------------------------------------------------
// Search result (lightweight -- no content field)
// ---------------------------------------------------------------------------

/** Lightweight search result safe to send to clients (no content field). */
export interface CatalogSearchResult {
  name: string;
  path: string;
  category: string;
  type: string;
  description: string;
  downloads: number;
}

// ---------------------------------------------------------------------------
// Import types
// ---------------------------------------------------------------------------

/** Options for importing an AITMPL component into Fleet Factory. */
export interface AitmplImportOptions {
  businessId: string;
  componentPath: string;
  componentType: AitmplComponentType;
  targetAgentId?: string;
  targetDepartmentId?: string;
}

/** Result of importing an AITMPL component. */
export interface AitmplImportResult {
  success: boolean;
  entityType: "skill" | "agent_prompt" | "tool_profile_mcp";
  entityId?: string;
  name: string;
  error?: string;
}
