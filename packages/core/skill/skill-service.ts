/**
 * Skill CRUD, assignment, and query operations.
 * All functions take SupabaseClient as first argument (matching existing service patterns).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Skill,
  SkillAssignment,
  SkillTemplate,
  SkillWithAssignment,
  SkillUsage,
} from "./skill-types";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Create a new skill in the business library. */
export async function createSkill(
  supabase: SupabaseClient,
  businessId: string,
  data: {
    name: string;
    description?: string;
    content: string;
    trigger_phrases?: string[];
    source_type?: "manual" | "imported" | "template";
    source_url?: string;
    import_collection?: string;
  },
): Promise<Skill> {
  const insertData: Record<string, unknown> = {
    business_id: businessId,
    name: data.name,
    description: data.description ?? null,
    content: data.content,
    trigger_phrases: data.trigger_phrases ?? null,
    source_type: data.source_type ?? "manual",
    source_url: data.source_url ?? null,
  };
  if (data.import_collection) {
    insertData.import_collection = data.import_collection;
  }

  const { data: skill, error } = await supabase
    .from("skills")
    .insert(insertData)
    .select("*")
    .single();

  if (error || !skill) {
    throw new Error(`Failed to create skill: ${error?.message ?? "Unknown error"}`);
  }

  return skill as unknown as Skill;
}

/** Update an existing skill. Increments version and updates updated_at. */
export async function updateSkill(
  supabase: SupabaseClient,
  skillId: string,
  businessId: string,
  data: {
    name?: string;
    description?: string;
    content?: string;
    trigger_phrases?: string[];
  },
): Promise<Skill> {
  // Fetch current version
  const { data: current, error: fetchError } = await supabase
    .from("skills")
    .select("version")
    .eq("id", skillId)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Skill not found: ${fetchError?.message ?? "Unknown error"}`);
  }

  const updatePayload: Record<string, unknown> = {
    version: (current.version as number) + 1,
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.description !== undefined) updatePayload.description = data.description;
  if (data.content !== undefined) updatePayload.content = data.content;
  if (data.trigger_phrases !== undefined) updatePayload.trigger_phrases = data.trigger_phrases;

  const { data: skill, error } = await supabase
    .from("skills")
    .update(updatePayload)
    .eq("id", skillId)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error || !skill) {
    throw new Error(`Failed to update skill: ${error?.message ?? "Unknown error"}`);
  }

  return skill as unknown as Skill;
}

/** Soft-delete a skill (sets deleted_at). Assignments remain for existing agents. */
export async function softDeleteSkill(
  supabase: SupabaseClient,
  skillId: string,
  businessId: string,
): Promise<void> {
  const { error } = await supabase
    .from("skills")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", skillId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to delete skill: ${error.message}`);
  }
}

/** Fetch a single skill by ID. */
export async function getSkill(
  supabase: SupabaseClient,
  skillId: string,
): Promise<Skill | null> {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("id", skillId)
    .single();

  if (error) return null;
  return data as unknown as Skill;
}

/** List all non-deleted skills for a business, ordered by name. */
export async function listSkillsForBusiness(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Skill[]> {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list skills: ${error.message}`);
  }

  return (data ?? []) as unknown as Skill[];
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/** Assign a skill to an agent or department. */
export async function assignSkill(
  supabase: SupabaseClient,
  skillId: string,
  businessId: string,
  target: { agent_id?: string; department_id?: string },
): Promise<SkillAssignment> {
  if (!target.agent_id && !target.department_id) {
    throw new Error("Must provide either agent_id or department_id");
  }

  const { data, error } = await supabase
    .from("skill_assignments")
    .insert({
      skill_id: skillId,
      business_id: businessId,
      agent_id: target.agent_id ?? null,
      department_id: target.department_id ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to assign skill: ${error?.message ?? "Unknown error"}`);
  }

  return data as unknown as SkillAssignment;
}

/** Remove a skill assignment. */
export async function unassignSkill(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("skill_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    throw new Error(`Failed to unassign skill: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Querying
// ---------------------------------------------------------------------------

/**
 * Get all skills assigned to an agent, including department-inherited ones.
 * Returns SkillWithAssignment[] with assignment_level indicating source.
 */
export async function getSkillsForAgent(
  supabase: SupabaseClient,
  agentId: string,
  departmentId: string,
): Promise<SkillWithAssignment[]> {
  // Direct agent assignments
  const { data: agentAssignments, error: agentErr } = await supabase
    .from("skill_assignments")
    .select("id, skill_id, skills(*)")
    .eq("agent_id", agentId);

  if (agentErr) {
    throw new Error(`Failed to fetch agent skills: ${agentErr.message}`);
  }

  // Department assignments (inherited)
  const { data: deptAssignments, error: deptErr } = await supabase
    .from("skill_assignments")
    .select("id, skill_id, skills(*)")
    .eq("department_id", departmentId);

  if (deptErr) {
    throw new Error(`Failed to fetch department skills: ${deptErr.message}`);
  }

  const results: SkillWithAssignment[] = [];

  // Add department skills first (inherited)
  for (const row of deptAssignments ?? []) {
    const skill = row.skills as unknown as Skill | null;
    if (!skill) continue;
    results.push({
      ...skill,
      assignment_level: "department",
      assignment_id: row.id as string,
    });
  }

  // Add agent skills (direct) -- these take precedence on name conflict
  for (const row of agentAssignments ?? []) {
    const skill = row.skills as unknown as Skill | null;
    if (!skill) continue;
    results.push({
      ...skill,
      assignment_level: "agent",
      assignment_id: row.id as string,
    });
  }

  return results;
}

/** Get all skills assigned to a department. */
export async function getSkillsForDepartment(
  supabase: SupabaseClient,
  departmentId: string,
): Promise<Skill[]> {
  const { data, error } = await supabase
    .from("skill_assignments")
    .select("skills(*)")
    .eq("department_id", departmentId);

  if (error) {
    throw new Error(`Failed to fetch department skills: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => row.skills as unknown as Skill | null)
    .filter((s): s is Skill => s !== null);
}

/** Get usage stats for a skill (how many agents/departments use it). */
export async function getSkillUsage(
  supabase: SupabaseClient,
  skillId: string,
): Promise<SkillUsage> {
  // Agent assignments with names
  const { data: agentRows, error: agentErr } = await supabase
    .from("skill_assignments")
    .select("agent_id, agents(id, name)")
    .eq("skill_id", skillId)
    .not("agent_id", "is", null);

  if (agentErr) {
    throw new Error(`Failed to fetch skill agent usage: ${agentErr.message}`);
  }

  // Department assignments with names
  const { data: deptRows, error: deptErr } = await supabase
    .from("skill_assignments")
    .select("department_id, departments(id, name)")
    .eq("skill_id", skillId)
    .not("department_id", "is", null);

  if (deptErr) {
    throw new Error(`Failed to fetch skill department usage: ${deptErr.message}`);
  }

  const agents = (agentRows ?? [])
    .map((row) => {
      const agent = row.agents as unknown as { id: string; name: string } | null;
      return agent ? { id: agent.id, name: agent.name } : null;
    })
    .filter((a): a is { id: string; name: string } => a !== null);

  const departments = (deptRows ?? [])
    .map((row) => {
      const dept = row.departments as unknown as { id: string; name: string } | null;
      return dept ? { id: dept.id, name: dept.name } : null;
    })
    .filter((d): d is { id: string; name: string } => d !== null);

  return {
    agent_count: agents.length,
    department_count: departments.length,
    agents,
    departments,
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Get active skill templates, optionally filtered by department type. */
export async function getSkillTemplates(
  supabase: SupabaseClient,
  departmentType?: string,
): Promise<SkillTemplate[]> {
  let query = supabase
    .from("skill_templates")
    .select("*")
    .eq("is_active", true)
    .order("department_type")
    .order("name");

  if (departmentType) {
    query = query.eq("department_type", departmentType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch skill templates: ${error.message}`);
  }

  return (data ?? []) as unknown as SkillTemplate[];
}

/** Create a business skill from a template (copy-and-customize model). */
export async function createSkillFromTemplate(
  supabase: SupabaseClient,
  businessId: string,
  templateId: string,
): Promise<Skill> {
  // Fetch the template
  const { data: template, error: fetchError } = await supabase
    .from("skill_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (fetchError || !template) {
    throw new Error(`Template not found: ${fetchError?.message ?? "Unknown error"}`);
  }

  // Create a new skill from the template
  return createSkill(supabase, businessId, {
    name: template.name as string,
    description: template.description as string | undefined,
    content: template.content as string,
    trigger_phrases: template.trigger_phrases as string[] | undefined,
    source_type: "template",
  });
}
