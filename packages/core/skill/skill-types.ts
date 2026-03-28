/**
 * Type definitions for the skill management module.
 */

/** A skill entity owned by a business. */
export interface Skill {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  content: string;
  trigger_phrases: string[] | null;
  source_type: "manual" | "imported" | "template";
  source_url: string | null;
  import_collection: string | null;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Assignment linking a skill to an agent or department. */
export interface SkillAssignment {
  id: string;
  skill_id: string;
  business_id: string;
  agent_id: string | null;
  department_id: string | null;
  created_at: string;
}

/** A globally-readable starter skill template. */
export interface SkillTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  department_type: string;
  role_type: string | null;
  trigger_phrases: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** The compiled SKILL.md output for deployment. */
export interface CompiledSkill {
  content: string;
  sources: Array<{
    skillId: string;
    name: string;
    level: "department" | "agent";
  }>;
}

/** A skill with its assignment level context. */
export interface SkillWithAssignment extends Skill {
  assignment_level: "department" | "agent";
  assignment_id: string;
}

/** Usage stats for a skill across agents and departments. */
export interface SkillUsage {
  agent_count: number;
  department_count: number;
  agents: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
}

/** Parsed info from a GitHub URL. */
export interface GitHubUrlInfo {
  owner: string;
  repo: string;
  path: string;
  branch: string;
  type: "file" | "directory";
}

/** Result of importing a skill from GitHub. */
export interface GitHubImportResult {
  name: string;
  content: string;
  source_url: string;
}
