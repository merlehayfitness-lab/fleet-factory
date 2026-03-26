/**
 * Per-department tool catalog with mock results.
 *
 * Each department has a curated set of tools with risk levels.
 * Mock results return realistic sample data for MVP testing.
 */

import type { DepartmentType } from "../types/index";

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  category: string;
  mockResult: (payload: Record<string, unknown>) => Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Owner tools
// ---------------------------------------------------------------------------
const ownerTools: ToolDefinition[] = [
  {
    name: "review_dashboard",
    description: "View the executive dashboard with KPIs and health metrics",
    riskLevel: "low",
    category: "analytics",
    mockResult: () => ({
      revenue_mtd: 124500,
      active_deals: 18,
      open_tickets: 7,
      agent_uptime: 99.8,
      updated_at: new Date().toISOString(),
    }),
  },
  {
    name: "generate_report",
    description: "Generate a business performance report",
    riskLevel: "medium",
    category: "analytics",
    mockResult: (payload) => ({
      report_id: `rpt-${Date.now()}`,
      type: payload.type ?? "weekly",
      sections: ["revenue", "pipeline", "support", "operations"],
      status: "generated",
      url: `https://reports.example.com/rpt-${Date.now()}.pdf`,
    }),
  },
  {
    name: "update_business_settings",
    description: "Update business configuration and preferences",
    riskLevel: "high",
    category: "admin",
    mockResult: (payload) => ({
      updated: true,
      setting: payload.setting ?? "general",
      previous_value: "default",
      new_value: payload.value ?? "updated",
    }),
  },
];

// ---------------------------------------------------------------------------
// Sales tools
// ---------------------------------------------------------------------------
const salesTools: ToolDefinition[] = [
  {
    name: "search_contacts",
    description: "Search CRM contacts by name, email, or company",
    riskLevel: "low",
    category: "crm",
    mockResult: (payload) => ({
      contacts: [
        { name: "Alice Johnson", email: "alice@acme.com", company: "Acme Corp" },
        { name: "Bob Smith", email: "bob@globex.com", company: "Globex Inc" },
        { name: "Carol Davis", email: "carol@initech.com", company: "Initech" },
      ],
      query: payload.query ?? "",
      total: 3,
    }),
  },
  {
    name: "draft_email",
    description: "Draft a sales email from a template or prompt",
    riskLevel: "medium",
    category: "email",
    mockResult: (payload) => ({
      draft_id: `draft-${Date.now()}`,
      to: payload.to ?? "prospect@example.com",
      subject: payload.subject ?? "Follow-up on our conversation",
      body: "Hi there, I wanted to follow up on our recent discussion...",
      status: "draft",
    }),
  },
  {
    name: "send_email",
    description: "Send an email to a contact",
    riskLevel: "high",
    category: "email",
    mockResult: (payload) => ({
      message_id: `msg-${Date.now()}`,
      status: "sent",
      to: payload.to ?? "prospect@example.com",
      sent_at: new Date().toISOString(),
    }),
  },
  {
    name: "create_deal",
    description: "Create a new deal in the sales pipeline",
    riskLevel: "medium",
    category: "crm",
    mockResult: (payload) => ({
      deal_id: `deal-${Date.now()}`,
      name: payload.name ?? "New Opportunity",
      stage: "qualification",
      value: payload.value ?? 10000,
      created_at: new Date().toISOString(),
    }),
  },
  {
    name: "update_deal_stage",
    description: "Move a deal to the next pipeline stage",
    riskLevel: "high",
    category: "crm",
    mockResult: (payload) => ({
      deal_id: payload.deal_id ?? "deal-123",
      previous_stage: "qualification",
      new_stage: payload.stage ?? "proposal",
      updated_at: new Date().toISOString(),
    }),
  },
];

// ---------------------------------------------------------------------------
// Support tools
// ---------------------------------------------------------------------------
const supportTools: ToolDefinition[] = [
  {
    name: "search_tickets",
    description: "Search support tickets by keyword, status, or priority",
    riskLevel: "low",
    category: "helpdesk",
    mockResult: (payload) => ({
      tickets: [
        { id: "TKT-101", subject: "Login issue", status: "open", priority: "high" },
        { id: "TKT-102", subject: "Billing question", status: "open", priority: "medium" },
        { id: "TKT-103", subject: "Feature request", status: "pending", priority: "low" },
      ],
      query: payload.query ?? "",
      total: 3,
    }),
  },
  {
    name: "create_ticket",
    description: "Create a new support ticket",
    riskLevel: "medium",
    category: "helpdesk",
    mockResult: (payload) => ({
      ticket_id: `TKT-${Date.now()}`,
      subject: payload.subject ?? "New support request",
      status: "open",
      priority: payload.priority ?? "medium",
      created_at: new Date().toISOString(),
    }),
  },
  {
    name: "respond_to_ticket",
    description: "Send a response to a customer on an open ticket",
    riskLevel: "high",
    category: "helpdesk",
    mockResult: (payload) => ({
      ticket_id: payload.ticket_id ?? "TKT-101",
      response_id: `resp-${Date.now()}`,
      status: "responded",
      sent_at: new Date().toISOString(),
    }),
  },
  {
    name: "close_ticket",
    description: "Close a resolved support ticket",
    riskLevel: "high",
    category: "helpdesk",
    mockResult: (payload) => ({
      ticket_id: payload.ticket_id ?? "TKT-101",
      status: "closed",
      resolution: payload.resolution ?? "Issue resolved",
      closed_at: new Date().toISOString(),
    }),
  },
  {
    name: "search_kb",
    description: "Search the knowledge base for articles",
    riskLevel: "low",
    category: "helpdesk",
    mockResult: (payload) => ({
      articles: [
        { id: "KB-001", title: "Getting Started Guide", relevance: 0.95 },
        { id: "KB-002", title: "Account Setup FAQ", relevance: 0.87 },
        { id: "KB-003", title: "Troubleshooting Common Issues", relevance: 0.82 },
      ],
      query: payload.query ?? "",
      total: 3,
    }),
  },
];

// ---------------------------------------------------------------------------
// Operations tools
// ---------------------------------------------------------------------------
const operationsTools: ToolDefinition[] = [
  {
    name: "check_system_status",
    description: "Check the status of system components and services",
    riskLevel: "low",
    category: "monitoring",
    mockResult: () => ({
      services: [
        { name: "API", status: "healthy", latency_ms: 45 },
        { name: "Database", status: "healthy", latency_ms: 12 },
        { name: "Worker", status: "healthy", latency_ms: 23 },
        { name: "Cache", status: "healthy", latency_ms: 3 },
      ],
      overall: "healthy",
      checked_at: new Date().toISOString(),
    }),
  },
  {
    name: "run_diagnostic",
    description: "Run a diagnostic check on a specific service",
    riskLevel: "medium",
    category: "monitoring",
    mockResult: (payload) => ({
      diagnostic_id: `diag-${Date.now()}`,
      service: payload.service ?? "api",
      result: "pass",
      checks: [
        { name: "connectivity", status: "pass" },
        { name: "response_time", status: "pass", value_ms: 42 },
        { name: "error_rate", status: "pass", value_pct: 0.1 },
      ],
      completed_at: new Date().toISOString(),
    }),
  },
  {
    name: "update_config",
    description: "Update a system configuration value",
    riskLevel: "high",
    category: "admin",
    mockResult: (payload) => ({
      config_key: payload.key ?? "rate_limit",
      previous_value: "100",
      new_value: payload.value ?? "200",
      updated_at: new Date().toISOString(),
      requires_restart: false,
    }),
  },
  {
    name: "schedule_maintenance",
    description: "Schedule a maintenance window for a service",
    riskLevel: "high",
    category: "admin",
    mockResult: (payload) => ({
      maintenance_id: `maint-${Date.now()}`,
      service: payload.service ?? "api",
      scheduled_at: payload.scheduled_at ?? new Date(Date.now() + 86400000).toISOString(),
      duration_minutes: payload.duration_minutes ?? 30,
      status: "scheduled",
    }),
  },
];

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** Full tool catalog keyed by department type. */
export const TOOL_CATALOG: Record<string, ToolDefinition[]> = {
  owner: ownerTools,
  sales: salesTools,
  support: supportTools,
  operations: operationsTools,
};

/**
 * Get the list of tools available for a department.
 * Returns an empty array for unknown department types.
 */
export function getToolsForDepartment(departmentType: string): ToolDefinition[] {
  return TOOL_CATALOG[departmentType] ?? [];
}

/**
 * Get the mock result for a tool by name.
 * Searches across all departments. Returns a generic result for unknown tools.
 */
export function getMockResult(
  toolName: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  for (const tools of Object.values(TOOL_CATALOG)) {
    const tool = tools.find((t) => t.name === toolName);
    if (tool) {
      return tool.mockResult(payload);
    }
  }
  return { error: "unknown_tool", tool: toolName };
}

/**
 * Get the risk level for a tool by name.
 * Returns "high" for unknown tools (fail-safe).
 */
export function getToolRiskLevel(toolName: string): "low" | "medium" | "high" {
  for (const tools of Object.values(TOOL_CATALOG)) {
    const tool = tools.find((t) => t.name === toolName);
    if (tool) {
      return tool.riskLevel;
    }
  }
  return "high"; // Unknown tools default to high risk
}
