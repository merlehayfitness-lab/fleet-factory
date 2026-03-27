/**
 * Generates AGENTS.md for an OpenClaw workspace.
 * Converts system_prompt + tool_profile into OpenClaw AGENTS.md format.
 * Enforces max 8000 char budget.
 */

const MAX_CHARS = 8000;

/** Scope boundaries by department type -- what the agent should NOT do */
const SCOPE_BOUNDARIES: Record<string, string[]> = {
  owner: [
    "Do not execute individual sales or support tasks directly",
    "Do not make changes without documenting the business rationale",
    "Do not share sensitive business metrics with non-owner roles",
  ],
  sales: [
    "Do not provide technical support or troubleshooting",
    "Do not modify system configurations or settings",
    "Do not access financial data beyond deal values",
    "Do not make promises about features not yet available",
  ],
  support: [
    "Do not initiate sales conversations or pitch products",
    "Do not access or modify billing information",
    "Do not make changes to system configurations",
    "Do not share internal operational details with customers",
  ],
  operations: [
    "Do not engage directly with customers or leads",
    "Do not make sales commitments or pricing decisions",
    "Do not modify agent configurations without approval",
    "Do not access customer conversation history",
  ],
  custom: [
    "Do not perform actions outside your assigned scope",
    "Do not access data from other departments without authorization",
  ],
};

/**
 * Extract the first paragraph from a system prompt as the role description.
 */
function extractRole(systemPrompt: string): string {
  const firstParagraph = systemPrompt.split(/\n\s*\n/)[0] || systemPrompt;
  return firstParagraph.trim();
}

/**
 * Extract operational rules from the system prompt (lines after the first paragraph).
 */
function extractRules(systemPrompt: string): string[] {
  const paragraphs = systemPrompt.split(/\n\s*\n/).slice(1);
  if (paragraphs.length === 0) return [];

  const rules: string[] = [];
  for (const para of paragraphs) {
    const lines = para.trim().split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s*/, "").trim();
      if (cleaned) rules.push(cleaned);
    }
  }
  return rules;
}

/**
 * Format tool profile into readable capabilities list.
 */
function formatTools(toolProfile: Record<string, unknown>): string[] {
  const tools: string[] = [];
  for (const [key, value] of Object.entries(toolProfile)) {
    if (typeof value === "object" && value !== null && "description" in value) {
      tools.push(`- **${key}**: ${(value as { description: string }).description}`);
    } else if (typeof value === "string") {
      tools.push(`- **${key}**: ${value}`);
    } else {
      tools.push(`- **${key}**: Enabled`);
    }
  }
  return tools;
}

export function generateAgentsMd(
  agentName: string,
  systemPrompt: string,
  toolProfile: Record<string, unknown>,
  departmentType: string,
): string {
  const role = extractRole(systemPrompt);
  const rules = extractRules(systemPrompt);
  const tools = formatTools(toolProfile);
  const boundaries = SCOPE_BOUNDARIES[departmentType] || SCOPE_BOUNDARIES.custom;

  // Build sections in priority order (higher priority = kept when truncating)
  let content = `# ${agentName}\n\n`;

  // Section 1: Role (highest priority)
  content += `## Role\n\n${role}\n\n`;

  // Section 2: Operational Rules
  if (rules.length > 0) {
    content += `## Operational Rules\n\n`;
    for (const rule of rules) {
      content += `- ${rule}\n`;
    }
    content += "\n";
  } else {
    content += `## Operational Rules\n\n`;
    content += `- Follow standard operating procedures for ${departmentType} department\n`;
    content += `- Prioritize accuracy and consistency in all responses\n`;
    content += `- Escalate uncertain situations to human operators\n`;
    content += "\n";
  }

  // Section 3: Tools & Capabilities
  if (tools.length > 0) {
    content += `## Tools & Capabilities\n\n`;
    for (const tool of tools) {
      content += `${tool}\n`;
    }
    content += "\n";
  }

  // Section 4: Scope Boundaries (lowest priority -- truncated first)
  const boundarySection = `## Scope Boundaries\n\n${boundaries.map((b) => `- ${b}`).join("\n")}\n`;

  // Enforce char limit by truncating lower-priority sections
  if (content.length + boundarySection.length <= MAX_CHARS) {
    content += boundarySection;
  } else if (content.length < MAX_CHARS) {
    // Truncate boundary section to fit
    const remaining = MAX_CHARS - content.length;
    content += boundarySection.slice(0, remaining);
  }

  // Final truncation if still over budget
  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS - 3) + "...";
  }

  return content;
}
