/**
 * Generates a SKILL.md file for an agent by merging department-level
 * baseline skills with agent-level specialization skills.
 *
 * Merge strategy:
 * - Neither skill defined: minimal default with agent name header
 * - Department skill only: use as base SKILL.md content
 * - Agent skill only: use directly
 * - Both defined: department baseline + agent specialization sections
 *
 * Character budget: ~4000 chars max.
 */

const MAX_CHARS = 4000;

/**
 * Generate a SKILL.md file content for an agent.
 */
export function generateSkillMd(
  agentName: string,
  departmentSkill: string | null,
  agentSkill: string | null,
): string {
  const hasDeptSkill = departmentSkill && departmentSkill.trim().length > 0;
  const hasAgentSkill = agentSkill && agentSkill.trim().length > 0;

  let content: string;

  if (!hasDeptSkill && !hasAgentSkill) {
    // Neither skill defined -- minimal default
    content = [
      "---",
      `name: ${agentName}`,
      `description: Skills for ${agentName}`,
      "---",
      "",
      `# ${agentName} Skills`,
      "",
      "No specific skills defined. This agent operates with default capabilities.",
      "",
    ].join("\n");
  } else if (hasDeptSkill && !hasAgentSkill) {
    // Department skill only -- use as base
    content = [
      "---",
      `name: ${agentName}`,
      `description: Department baseline skills for ${agentName}`,
      "---",
      "",
      `# ${agentName} Skills`,
      "",
      departmentSkill.trim(),
      "",
    ].join("\n");
  } else if (!hasDeptSkill && hasAgentSkill) {
    // Agent skill only -- use directly
    content = [
      "---",
      `name: ${agentName}`,
      `description: Specialized skills for ${agentName}`,
      "---",
      "",
      `# ${agentName} Skills`,
      "",
      agentSkill.trim(),
      "",
    ].join("\n");
  } else {
    // Both exist -- merge with sections
    content = [
      "---",
      `name: ${agentName}`,
      `description: Department baseline and agent specialization skills for ${agentName}`,
      "---",
      "",
      `# ${agentName} Skills`,
      "",
      "## Department Baseline",
      "",
      departmentSkill!.trim(),
      "",
      "## Agent Specialization",
      "",
      agentSkill!.trim(),
      "",
    ].join("\n");
  }

  // Enforce character budget
  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS - 4) + "\n...\n";
  }

  return content;
}
