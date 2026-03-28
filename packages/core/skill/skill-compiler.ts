/**
 * Compiles multiple assigned skills into a single SKILL.md for deployment.
 *
 * Merge strategy:
 * 1. Department skills listed under "## Department Skills"
 * 2. Agent skills listed under "## Agent Skills"
 * 3. Name conflict: agent-level skill takes precedence (department version skipped)
 * 4. Character budget: 4000 chars with truncation marker
 */

import type { Skill, CompiledSkill } from "./skill-types";

const MAX_CHARS = 4000;

/**
 * Compile department-level and agent-level skills into a single SKILL.md.
 *
 * @param agentName - The agent's display name (used in frontmatter)
 * @param departmentSkills - Skills inherited from the department
 * @param agentSkills - Skills directly assigned to the agent
 * @returns CompiledSkill with merged content and source tracking
 */
export function compileSkills(
  agentName: string,
  departmentSkills: Skill[],
  agentSkills: Skill[],
): CompiledSkill {
  const sources: CompiledSkill["sources"] = [];

  // Build a set of agent skill names for conflict detection
  const agentSkillNames = new Set(agentSkills.map((s) => s.name.toLowerCase()));

  // Filter department skills, removing those overridden by agent-level skills
  const filteredDeptSkills: Skill[] = [];
  const overriddenNames: string[] = [];

  for (const skill of departmentSkills) {
    if (agentSkillNames.has(skill.name.toLowerCase())) {
      overriddenNames.push(skill.name);
    } else {
      filteredDeptSkills.push(skill);
    }
  }

  const hasAnySkill = filteredDeptSkills.length > 0 || agentSkills.length > 0;

  // Build frontmatter
  const lines: string[] = [
    "---",
    `name: ${agentName}`,
    `description: ${hasAnySkill ? `Combined skills for ${agentName}` : `Skills for ${agentName}`}`,
    "---",
    "",
    `# ${agentName} Skills`,
    "",
  ];

  if (!hasAnySkill) {
    lines.push("No specific skills defined. This agent operates with default capabilities.");
    lines.push("");
  }

  // Department Skills section
  if (filteredDeptSkills.length > 0) {
    lines.push("## Department Skills");
    lines.push("");

    for (const skill of filteredDeptSkills) {
      lines.push(`### ${skill.name}`);
      lines.push("");
      lines.push(skill.content.trim());
      lines.push("");
      sources.push({ skillId: skill.id, name: skill.name, level: "department" });
    }
  }

  // Note overrides
  if (overriddenNames.length > 0) {
    lines.push(
      `<!-- Overridden department skills: ${overriddenNames.join(", ")} (agent-level takes precedence) -->`,
    );
    lines.push("");
  }

  // Agent Skills section
  if (agentSkills.length > 0) {
    lines.push("## Agent Skills");
    lines.push("");

    for (const skill of agentSkills) {
      lines.push(`### ${skill.name}`);
      lines.push("");
      lines.push(skill.content.trim());
      lines.push("");
      sources.push({ skillId: skill.id, name: skill.name, level: "agent" });
    }
  }

  let content = lines.join("\n");

  // Enforce character budget
  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS - 4) + "\n...\n";
  }

  return { content, sources };
}
