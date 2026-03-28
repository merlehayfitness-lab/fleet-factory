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
  getSkillUsage,
  getSkillTemplates,
  createSkillFromTemplate,
  listSkillsForBusiness,
} from "@agency-factory/core/server";
import type {
  Skill,
  SkillWithAssignment,
  SkillTemplate,
  SkillUsage,
  SkillAssignment,
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
