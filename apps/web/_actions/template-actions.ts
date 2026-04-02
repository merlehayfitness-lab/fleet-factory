"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@fleet-factory/core";

/**
 * Create a new agent template from form data.
 */
export async function createTemplateAction(formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const name = formData.get("name") as string;
  const department_type = formData.get("department_type") as string;
  const description = (formData.get("description") as string) || undefined;
  const system_prompt = formData.get("system_prompt") as string;

  let tool_profile: Record<string, unknown> | undefined;
  let model_profile: Record<string, unknown> | undefined;

  const toolProfileRaw = formData.get("tool_profile") as string;
  if (toolProfileRaw && toolProfileRaw.trim()) {
    try {
      tool_profile = JSON.parse(toolProfileRaw);
    } catch {
      return { error: "Invalid JSON in tool profile" };
    }
  }

  const modelProfileRaw = formData.get("model_profile") as string;
  if (modelProfileRaw && modelProfileRaw.trim()) {
    try {
      model_profile = JSON.parse(modelProfileRaw);
    } catch {
      return { error: "Invalid JSON in model profile" };
    }
  }

  try {
    const template = await createTemplate(supabase, {
      name,
      department_type: department_type as
        | "owner"
        | "sales"
        | "support"
        | "operations",
      description,
      system_prompt,
      tool_profile,
      model_profile,
    });

    revalidatePath("/businesses");
    return { success: true, templateId: template.id as string };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to create template",
    };
  }
}

/**
 * Update an existing agent template.
 */
export async function updateTemplateAction(
  templateId: string,
  formData: FormData,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const name = formData.get("name") as string;
  const department_type = formData.get("department_type") as string;
  const description = (formData.get("description") as string) || undefined;
  const system_prompt = formData.get("system_prompt") as string;

  let tool_profile: Record<string, unknown> | undefined;
  let model_profile: Record<string, unknown> | undefined;

  const toolProfileRaw = formData.get("tool_profile") as string;
  if (toolProfileRaw && toolProfileRaw.trim()) {
    try {
      tool_profile = JSON.parse(toolProfileRaw);
    } catch {
      return { error: "Invalid JSON in tool profile" };
    }
  }

  const modelProfileRaw = formData.get("model_profile") as string;
  if (modelProfileRaw && modelProfileRaw.trim()) {
    try {
      model_profile = JSON.parse(modelProfileRaw);
    } catch {
      return { error: "Invalid JSON in model profile" };
    }
  }

  try {
    await updateTemplate(supabase, templateId, {
      name,
      department_type: department_type as
        | "owner"
        | "sales"
        | "support"
        | "operations",
      description,
      system_prompt,
      tool_profile,
      model_profile,
    });

    revalidatePath("/businesses");
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to update template",
    };
  }
}

/**
 * Delete an agent template. Blocked if non-retired agents reference it.
 */
export async function deleteTemplateAction(templateId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await deleteTemplate(supabase, templateId);
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to delete template",
    };
  }

  revalidatePath("/businesses");
  return { success: true };
}
