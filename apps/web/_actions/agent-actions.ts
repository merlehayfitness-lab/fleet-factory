"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  transitionAgentStatus,
  updateAgentConfig,
} from "@agency-factory/core";

/**
 * Freeze an agent (emergency stop). Transitions to 'frozen' status.
 */
export async function freezeAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await transitionAgentStatus(supabase, agentId, businessId, "frozen");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to freeze agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Pause an agent. Transitions to 'paused' status.
 */
export async function pauseAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await transitionAgentStatus(supabase, agentId, businessId, "paused");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to pause agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Resume an agent. Transitions to 'active' status.
 */
export async function resumeAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await transitionAgentStatus(supabase, agentId, businessId, "active");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to resume agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Retire an agent permanently. Transitions to 'retired' (terminal) status.
 */
export async function retireAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await transitionAgentStatus(supabase, agentId, businessId, "retired");
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to retire agent",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}

/**
 * Update an agent's configuration (system prompt, tool profile, model profile).
 */
export async function updateAgentConfigAction(
  agentId: string,
  businessId: string,
  config: {
    system_prompt?: string;
    tool_profile?: Record<string, unknown>;
    model_profile?: Record<string, unknown>;
  },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await updateAgentConfig(supabase, agentId, businessId, config);
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to update agent config",
    };
  }

  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}
