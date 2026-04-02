"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  freezeAgentWithReason,
  revokeToolAccess,
  disableAgent,
  restoreAgent,
  disableTenant,
  restoreTenant,
} from "@fleet-factory/core/server";

/**
 * Emergency freeze an agent with reason and audit trail.
 */
export async function freezeAgentEmergency(
  agentId: string,
  businessId: string,
  reason: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await freezeAgentWithReason(supabase, agentId, businessId, reason, user.id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to freeze agent",
    };
  }

  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/logs`);
  return { success: true };
}

/**
 * Emergency revoke all tool access for an agent.
 */
export async function revokeTools(
  agentId: string,
  businessId: string,
  reason: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await revokeToolAccess(supabase, agentId, businessId, reason, user.id);
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to revoke tool access",
    };
  }

  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/logs`);
  return { success: true };
}

/**
 * Emergency disable (retire) an agent permanently.
 */
export async function disableAgentEmergency(
  agentId: string,
  businessId: string,
  reason: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await disableAgent(supabase, agentId, businessId, reason, user.id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to disable agent",
    };
  }

  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/logs`);
  return { success: true };
}

/**
 * Restore a frozen agent back to active status.
 */
export async function restoreAgentEmergency(
  agentId: string,
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
    await restoreAgent(supabase, agentId, businessId, user.id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to restore agent",
    };
  }

  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/logs`);
  return { success: true };
}

/**
 * Disable an entire tenant (business) and freeze all agents.
 */
export async function disableTenantAction(
  businessId: string,
  reason: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await disableTenant(supabase, businessId, reason, user.id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to disable tenant",
    };
  }

  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/logs`);
  return { success: true };
}

/**
 * Restore a disabled tenant back to active status.
 * Agents remain frozen for manual review.
 */
export async function restoreTenantAction(
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
    await restoreTenant(supabase, businessId, user.id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to restore tenant",
    };
  }

  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/logs`);
  return { success: true };
}
