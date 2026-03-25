import type { SupabaseClient } from "@supabase/supabase-js";
import { createTemplateSchema, updateTemplateSchema } from "./template-schema";
import type { CreateTemplateInput, UpdateTemplateInput } from "./template-schema";

/**
 * Fetch all agent templates, ordered by department_type then name.
 * Templates are global (not scoped to a specific business).
 */
export async function getTemplates(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("agent_templates")
    .select("*")
    .order("department_type")
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }

  return data;
}

/**
 * Fetch a single template by ID.
 * Throws if the template is not found.
 */
export async function getTemplateById(
  supabase: SupabaseClient,
  templateId: string,
) {
  const { data, error } = await supabase
    .from("agent_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error || !data) {
    throw new Error(
      `Template not found: ${error?.message ?? "No template with that ID"}`,
    );
  }

  return data;
}

/**
 * Create a new agent template.
 * Validates input with Zod before inserting.
 */
export async function createTemplate(
  supabase: SupabaseClient,
  input: CreateTemplateInput,
) {
  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(`Validation failed: ${firstIssue?.message ?? "Invalid input"}`);
  }

  const { data, error } = await supabase
    .from("agent_templates")
    .insert({
      name: parsed.data.name,
      department_type: parsed.data.department_type,
      description: parsed.data.description ?? null,
      system_prompt: parsed.data.system_prompt,
      tool_profile: parsed.data.tool_profile ?? {},
      model_profile: parsed.data.model_profile ?? {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create template: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing agent template.
 * Validates input with Zod before updating. Only updates provided fields.
 */
export async function updateTemplate(
  supabase: SupabaseClient,
  templateId: string,
  input: UpdateTemplateInput,
) {
  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(`Validation failed: ${firstIssue?.message ?? "Invalid input"}`);
  }

  // Build update payload from defined fields only
  const updatePayload: Record<string, unknown> = {};
  const data = parsed.data;
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.department_type !== undefined)
    updatePayload.department_type = data.department_type;
  if (data.description !== undefined)
    updatePayload.description = data.description;
  if (data.system_prompt !== undefined)
    updatePayload.system_prompt = data.system_prompt;
  if (data.tool_profile !== undefined)
    updatePayload.tool_profile = data.tool_profile;
  if (data.model_profile !== undefined)
    updatePayload.model_profile = data.model_profile;

  const { data: updated, error } = await supabase
    .from("agent_templates")
    .update(updatePayload)
    .eq("id", templateId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update template: ${error.message}`);
  }

  return updated;
}

/**
 * Delete an agent template.
 * Refuses to delete if the template is still referenced by non-retired agents.
 */
export async function deleteTemplate(
  supabase: SupabaseClient,
  templateId: string,
) {
  // Check for active references
  const { count, error: countError } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId)
    .neq("status", "retired");

  if (countError) {
    throw new Error(
      `Failed to check template references: ${countError.message}`,
    );
  }

  if (count && count > 0) {
    throw new Error(
      `Cannot delete template: ${count} non-retired agent(s) still reference this template. Retire them first.`,
    );
  }

  const { error } = await supabase
    .from("agent_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    throw new Error(`Failed to delete template: ${error.message}`);
  }
}
