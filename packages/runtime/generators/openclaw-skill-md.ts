/**
 * Generates a SKILL.md file for an agent.
 *
 * Supports two call signatures:
 * 1. Legacy (two text blobs): generateSkillMd(agentName, departmentSkill, agentSkill)
 * 2. New (multi-skill array): generateSkillMd(agentName, skills)
 *
 * Character budget: ~4000 chars max.
 */

const MAX_CHARS = 4000;

/** Input for the new multi-skill signature. */
export interface SkillInput {
  name: string;
  content: string;
  level: "department" | "agent";
}

/**
 * Generate a SKILL.md file content for an agent.
 *
 * Overload 1: New multi-skill array form.
 * Overload 2: Legacy two-blob form (backward compatible).
 */
export function generateSkillMd(
  agentName: string,
  skills: SkillInput[],
): string;
export function generateSkillMd(
  agentName: string,
  departmentSkill: string | null,
  agentSkill: string | null,
): string;
export function generateSkillMd(
  agentName: string,
  skillsOrDeptSkill: SkillInput[] | string | null,
  agentSkill?: string | null,
): string {
  // Detect which overload was called
  if (Array.isArray(skillsOrDeptSkill)) {
    return generateFromArray(agentName, skillsOrDeptSkill);
  }

  return generateFromBlobs(agentName, skillsOrDeptSkill, agentSkill ?? null);
}

// ---------------------------------------------------------------------------
// New multi-skill array implementation
// ---------------------------------------------------------------------------

function generateFromArray(agentName: string, skills: SkillInput[]): string {
  const deptSkills = skills.filter((s) => s.level === "department");
  const agentSkills = skills.filter((s) => s.level === "agent");

  const hasAny = deptSkills.length > 0 || agentSkills.length > 0;

  const lines: string[] = [
    "---",
    `name: ${agentName}`,
    `description: ${hasAny ? `Combined skills for ${agentName}` : `Skills for ${agentName}`}`,
    "---",
    "",
    `# ${agentName} Skills`,
    "",
  ];

  if (!hasAny) {
    lines.push("No specific skills defined. This agent operates with default capabilities.");
    lines.push("");
  }

  if (deptSkills.length > 0) {
    lines.push("## Department Skills");
    lines.push("");
    for (const skill of deptSkills) {
      lines.push(`### ${skill.name}`);
      lines.push("");
      lines.push(skill.content.trim());
      lines.push("");
    }
  }

  if (agentSkills.length > 0) {
    lines.push("## Agent Skills");
    lines.push("");
    for (const skill of agentSkills) {
      lines.push(`### ${skill.name}`);
      lines.push("");
      lines.push(skill.content.trim());
      lines.push("");
    }
  }

  let content = lines.join("\n");

  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS - 4) + "\n...\n";
  }

  return content;
}

// ---------------------------------------------------------------------------
// Legacy two-blob implementation (unchanged behavior)
// ---------------------------------------------------------------------------

function generateFromBlobs(
  agentName: string,
  departmentSkill: string | null,
  agentSkill: string | null,
): string {
  const hasDeptSkill = departmentSkill && departmentSkill.trim().length > 0;
  const hasAgentSkill = agentSkill && agentSkill.trim().length > 0;

  let content: string;

  if (!hasDeptSkill && !hasAgentSkill) {
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

  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS - 4) + "\n...\n";
  }

  return content;
}
