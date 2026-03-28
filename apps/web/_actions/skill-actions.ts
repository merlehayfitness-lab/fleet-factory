"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createSkill,
  updateSkill,
  softDeleteSkill,
  assignSkill,
  unassignSkill,
  getSkillsForAgent,
  getSkillsForDepartment,
  getSkillUsage,
  getSkillTemplates,
  createSkillFromTemplate,
  listSkillsForBusiness,
  parseGitHubUrl,
  fetchGitHubFile,
  fetchGitHubDirectory,
} from "@agency-factory/core/server";
import type {
  Skill,
  SkillWithAssignment,
  SkillTemplate,
  SkillUsage,
  SkillAssignment,
  GitHubImportResult,
} from "@agency-factory/core";

/**
 * Create a new skill in the business library.
 */
export async function createSkillAction(
  businessId: string,
  data: {
    name: string;
    description?: string;
    content: string;
    trigger_phrases?: string[];
  },
): Promise<{ skill: Skill } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!data.name.trim()) {
    return { error: "Skill name is required" };
  }

  try {
    const skill = await createSkill(supabase, businessId, {
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      content: data.content,
      trigger_phrases: data.trigger_phrases?.filter((p) => p.trim()) ?? undefined,
    });

    revalidatePath(`/businesses/${businessId}`);
    return { skill };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create skill",
    };
  }
}

/**
 * Update an existing skill. Increments version automatically.
 */
export async function updateSkillAction(
  skillId: string,
  businessId: string,
  data: {
    name?: string;
    description?: string;
    content?: string;
    trigger_phrases?: string[];
  },
): Promise<{ skill: Skill } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const skill = await updateSkill(supabase, skillId, businessId, {
      name: data.name?.trim(),
      description: data.description?.trim(),
      content: data.content,
      trigger_phrases: data.trigger_phrases?.filter((p) => p.trim()),
    });

    revalidatePath(`/businesses/${businessId}`);
    return { skill };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update skill",
    };
  }
}

/**
 * Soft-delete a skill (sets deleted_at; assignments remain).
 */
export async function deleteSkillAction(
  skillId: string,
  businessId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await softDeleteSkill(supabase, skillId, businessId);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete skill",
    };
  }
}

/**
 * Assign a skill to an agent or department.
 */
export async function assignSkillAction(
  skillId: string,
  businessId: string,
  target: { agent_id?: string; department_id?: string },
): Promise<{ assignment: SkillAssignment } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!target.agent_id && !target.department_id) {
    return { error: "Must provide either agent_id or department_id" };
  }

  try {
    const assignment = await assignSkill(supabase, skillId, businessId, target);
    revalidatePath(`/businesses/${businessId}`);
    return { assignment };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to assign skill",
    };
  }
}

/**
 * Remove a skill assignment.
 */
export async function unassignSkillAction(
  assignmentId: string,
  businessId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await unassignSkill(supabase, assignmentId);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to unassign skill",
    };
  }
}

/**
 * Get all skills for an agent (direct + department-inherited).
 */
export async function getSkillsForAgentAction(
  agentId: string,
  departmentId: string,
): Promise<{ skills: SkillWithAssignment[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const skills = await getSkillsForAgent(supabase, agentId, departmentId);
    return { skills };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch agent skills",
    };
  }
}

/**
 * Get available skill templates, optionally filtered by department type.
 */
export async function getSkillTemplatesAction(
  departmentType?: string,
): Promise<{ templates: SkillTemplate[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const templates = await getSkillTemplates(supabase, departmentType);
    return { templates };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch templates",
    };
  }
}

/**
 * Create a skill from a template (copy-and-customize model).
 */
export async function createSkillFromTemplateAction(
  businessId: string,
  templateId: string,
): Promise<{ skill: Skill } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const skill = await createSkillFromTemplate(supabase, businessId, templateId);
    revalidatePath(`/businesses/${businessId}`);
    return { skill };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create skill from template",
    };
  }
}

/**
 * Get usage stats for a skill (agents and departments using it).
 */
export async function getSkillUsageAction(
  skillId: string,
): Promise<{ usage: SkillUsage } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const usage = await getSkillUsage(supabase, skillId);
    return { usage };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch skill usage",
    };
  }
}

/**
 * List all non-deleted skills for a business.
 */
export async function listSkillsForBusinessAction(
  businessId: string,
): Promise<{ skills: Skill[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const skills = await listSkillsForBusiness(supabase, businessId);
    return { skills };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to list skills",
    };
  }
}

/**
 * Get all skills assigned to a department.
 */
export async function getDepartmentSkillsAction(
  departmentId: string,
): Promise<{ skills: Skill[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const skills = await getSkillsForDepartment(supabase, departmentId);
    return { skills };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch department skills",
    };
  }
}

/**
 * Preview a GitHub URL before import.
 * For files: returns content preview. For directories: returns list of .md files.
 * No database writes -- preview only.
 */
export async function previewGitHubUrlAction(
  url: string,
): Promise<
  | { type: "file"; preview: GitHubImportResult }
  | { type: "directory"; files: string[] }
  | { error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const info = parseGitHubUrl(url);
  if (!info) {
    return { error: "Invalid GitHub URL. Must be a blob (file) or tree (directory) URL from github.com." };
  }

  try {
    if (info.type === "file") {
      const result = await fetchGitHubFile(info);
      return { type: "file", preview: result };
    }

    // Directory: fetch listing via GitHub API
    const apiUrl = `https://api.github.com/repos/${info.owner}/${info.repo}/contents/${info.path}?ref=${info.branch}`;
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { error: `Failed to list directory: HTTP ${response.status}` };
    }

    const items = (await response.json()) as Array<{ name: string; type: string }>;
    const mdFiles = items
      .filter((item) => item.type === "file" && item.name.toLowerCase().endsWith(".md"))
      .map((item) => item.name);

    if (mdFiles.length === 0) {
      return { error: "No .md files found in this directory." };
    }

    return { type: "directory", files: mdFiles };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to preview GitHub URL",
    };
  }
}

/**
 * Import skills from a GitHub URL.
 * For files: creates a single skill. For directories: creates skills for all .md files.
 * Optionally assigns imported skills to an agent.
 */
export async function importFromGitHubAction(
  businessId: string,
  url: string,
  agentId?: string,
): Promise<{ skills: Skill[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const info = parseGitHubUrl(url);
  if (!info) {
    return { error: "Invalid GitHub URL. Must be a blob (file) or tree (directory) URL from github.com." };
  }

  try {
    let importResults: GitHubImportResult[];

    if (info.type === "file") {
      const result = await fetchGitHubFile(info);
      importResults = [result];
    } else {
      importResults = await fetchGitHubDirectory(info);
      if (importResults.length === 0) {
        return { error: "No .md files found in this directory." };
      }
    }

    const createdSkills: Skill[] = [];

    for (const result of importResults) {
      const skill = await createSkill(supabase, businessId, {
        name: result.name,
        content: result.content,
        source_type: "imported",
        source_url: result.source_url,
      });

      if (agentId) {
        await assignSkill(supabase, skill.id, businessId, { agent_id: agentId });
      }

      createdSkills.push(skill);
    }

    revalidatePath(`/businesses/${businessId}`);
    return { skills: createdSkills };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to import from GitHub",
    };
  }
}
