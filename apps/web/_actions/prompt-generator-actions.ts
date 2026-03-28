"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  generatePromptAndSkill,
  refinePrompt,
  sendTestMessage,
} from "@agency-factory/core/server";
import { updateAgentConfig } from "@agency-factory/core";
import type {
  RoleDefinition,
  GenerationResult,
  PromptSections,
  RefinementResult,
  TestChatMessage,
} from "@agency-factory/core";

/**
 * Generate a system prompt and SKILL.md from a role definition.
 * Also saves the role_definition to the agent record.
 */
export async function generatePromptAction(
  agentId: string,
  businessId: string,
  roleDefinition: RoleDefinition,
  knowledgeDocTitles: string[],
  integrationNames: string[],
): Promise<{ data?: GenerationResult; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    // Fetch business info for context
    const { data: business } = await supabase
      .from("businesses")
      .select("name, industry")
      .eq("id", businessId)
      .single();

    // Fetch agent department type
    const { data: agent } = await supabase
      .from("agents")
      .select("departments(type)")
      .eq("id", agentId)
      .eq("business_id", businessId)
      .single();

    // departments comes back as object or array depending on join
    const dept = agent?.departments as unknown;
    const deptType =
      dept && typeof dept === "object" && !Array.isArray(dept)
        ? (dept as { type: string }).type
        : Array.isArray(dept) && dept.length > 0
          ? (dept[0] as { type: string }).type
          : "general";

    const businessContext = {
      name: business?.name ?? "Unknown",
      industry: business?.industry ?? "general",
      departmentType: deptType,
    };

    const result = await generatePromptAndSkill(
      roleDefinition,
      businessContext,
      knowledgeDocTitles,
      integrationNames,
    );

    // Save role_definition to agent
    await updateAgentConfig(supabase, agentId, businessId, {
      role_definition: roleDefinition as unknown as Record<string, unknown>,
    });

    return { data: result };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to generate prompt",
    };
  }
}

/**
 * Refine an existing system prompt based on admin feedback.
 */
export async function refinePromptAction(
  currentSections: PromptSections,
  refinementMessage: string,
  conversationHistory: { role: string; content: string }[],
): Promise<{ data?: RefinementResult; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const result = await refinePrompt({
      currentSections,
      refinementMessage,
      conversationHistory,
    });

    return { data: result };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to refine prompt",
    };
  }
}

/**
 * Send a test chat message using a draft system prompt.
 */
export async function testChatAction(
  systemPrompt: string,
  messages: TestChatMessage[],
  modelProfile?: Record<string, unknown>,
): Promise<{ data?: string; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const response = await sendTestMessage(systemPrompt, messages, modelProfile);
    return { data: response };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to send test message",
    };
  }
}

/**
 * Save role definition, system prompt, and skill definition to agent.
 */
export async function saveRoleDefinitionAction(
  agentId: string,
  businessId: string,
  roleDefinition: RoleDefinition,
  systemPrompt: string,
  skillDefinition: string,
): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await updateAgentConfig(supabase, agentId, businessId, {
      role_definition: roleDefinition as unknown as Record<string, unknown>,
      system_prompt: systemPrompt,
      skill_definition: skillDefinition,
    });
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to save role definition",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
  return {};
}
