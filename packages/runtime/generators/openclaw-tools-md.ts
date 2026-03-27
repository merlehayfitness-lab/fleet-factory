/**
 * Generates TOOLS.md for an OpenClaw workspace.
 * Lists integration endpoints, API info, and department-specific tool instructions.
 * Enforces max 4000 char budget.
 */

const MAX_CHARS = 4000;

interface IntegrationInfo {
  type: string;
  provider: string;
  config?: Record<string, unknown>;
  status: string;
}

const DEPARTMENT_TOOL_INSTRUCTIONS: Record<string, string[]> = {
  owner: [
    "Use reporting tools to gather metrics before making decisions",
    "Review cross-department data for strategic insights",
    "Document all configuration changes in audit logs",
  ],
  sales: [
    "Use CRM tools for lead tracking and pipeline management",
    "Log all customer interactions for follow-up",
    "Use email tools for outreach with approved templates only",
    "Track deal progression through defined stages",
  ],
  support: [
    "Use helpdesk tools to manage ticket lifecycle",
    "Search knowledge base before escalating",
    "Log resolution steps for future reference",
    "Use messaging tools for real-time customer communication",
  ],
  operations: [
    "Use calendar tools for scheduling and resource allocation",
    "Monitor system metrics through reporting integrations",
    "Document process changes with before/after comparisons",
    "Use automation tools for repetitive workflow tasks",
  ],
  custom: [
    "Use available tools within your defined scope",
    "Log all tool usage for audit purposes",
    "Report tool errors or unexpected behavior immediately",
  ],
};

export function generateToolsMd(
  integrations: IntegrationInfo[],
  departmentType: string,
): string {
  const instructions =
    DEPARTMENT_TOOL_INSTRUCTIONS[departmentType] ||
    DEPARTMENT_TOOL_INSTRUCTIONS.custom;

  let content = `# Tools & Integrations\n\n`;

  // Active integrations
  const activeIntegrations = integrations.filter((i) => i.status !== "inactive");

  if (activeIntegrations.length > 0) {
    content += `## Available Integrations\n\n`;
    for (const integration of activeIntegrations) {
      content += `### ${integration.type.toUpperCase()}: ${integration.provider}\n\n`;
      content += `- **Status:** ${integration.status}\n`;
      if (integration.config && Object.keys(integration.config).length > 0) {
        const safeConfig = Object.entries(integration.config)
          .filter(([key]) => !key.toLowerCase().includes("secret") && !key.toLowerCase().includes("key"))
          .map(([key, value]) => `  - ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
          .join("\n");
        if (safeConfig) {
          content += `- **Configuration:**\n${safeConfig}\n`;
        }
      }
      content += "\n";
    }
  } else {
    content += `## Available Integrations\n\n`;
    content += `No integrations configured. Using mock adapters for development.\n\n`;
  }

  // Department-specific instructions
  content += `## Usage Guidelines\n\n`;
  for (const instruction of instructions) {
    content += `- ${instruction}\n`;
  }
  content += "\n";

  content += `## Error Handling\n\n`;
  content += `- If a tool call fails, log the error and attempt a graceful fallback\n`;
  content += `- Do not retry failed calls more than 2 times\n`;
  content += `- Report persistent failures for human review\n`;

  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS - 3) + "...";
  }

  return content;
}
