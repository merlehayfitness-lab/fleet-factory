/**
 * Generates IDENTITY.md for an OpenClaw workspace.
 * Short identity file with agent name, department emoji, and role description.
 * Enforces max 500 char budget.
 */

const MAX_CHARS = 500;

const DEPARTMENT_EMOJIS: Record<string, string> = {
  owner: "crown",
  sales: "chart_increasing",
  support: "headphones",
  operations: "gear",
  custom: "robot",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Strategic business oversight and high-level decision making",
  sales: "Lead generation, outreach, and deal management",
  support: "Customer support and issue resolution",
  operations: "Internal operations, scheduling, and process management",
  custom: "Specialized task execution and domain expertise",
};

export function generateIdentityMd(
  agentName: string,
  departmentType: string,
): string {
  const emoji = DEPARTMENT_EMOJIS[departmentType] || DEPARTMENT_EMOJIS.custom;
  const roleDescription = ROLE_DESCRIPTIONS[departmentType] || ROLE_DESCRIPTIONS.custom;

  let content = `# Identity\n\n`;
  content += `**Name:** ${agentName}\n`;
  content += `**Department:** :${emoji}: ${departmentType.charAt(0).toUpperCase() + departmentType.slice(1)}\n`;
  content += `**Role:** ${roleDescription}\n`;

  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS - 3) + "...";
  }

  return content;
}
