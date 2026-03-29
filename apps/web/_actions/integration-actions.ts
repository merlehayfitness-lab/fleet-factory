"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCatalogEntry, bulkCreateIntegrations } from "@agency-factory/core";

/**
 * Save (persist) AI-generated setup instructions for an integration.
 *
 * Fallback action for cases where the API route's DB write fails or
 * for manual saves. The primary save path is the streaming API route
 * which persists after stream completes.
 */
export async function saveSetupInstructionsAction(
  integrationId: string,
  businessId: string,
  instructions: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const { error } = await supabase
      .from("integrations")
      .update({ setup_instructions: instructions })
      .eq("id", integrationId)
      .eq("business_id", businessId);

    if (error) throw new Error(error.message);

    revalidatePath(`/businesses/${businessId}/integrations`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to save setup instructions",
    };
  }
}

/**
 * Fetch all integrations for a specific agent.
 */
export async function getAgentIntegrationsAction(agentId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const { data, error } = await supabase
      .from("integrations")
      .select("*")
      .eq("agent_id", agentId)
      .order("type");

    if (error) throw new Error(error.message);

    return { integrations: data ?? [] };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch integrations",
    };
  }
}

/**
 * Fetch all integrations for a business with agent and department names.
 */
export async function getBusinessIntegrationsAction(businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const { data, error } = await supabase
      .from("integrations")
      .select("*, agents(id, name), departments(id, name)")
      .eq("business_id", businessId)
      .order("type")
      .order("created_at");

    if (error) throw new Error(error.message);

    return { integrations: data ?? [] };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch business integrations",
    };
  }
}

/**
 * Add an integration from the catalog to multiple targets (departments and/or agents).
 * Category is auto-populated from the catalog entry.
 */
export async function addCatalogIntegrationAction(
  businessId: string,
  catalogEntryId: string,
  departmentIds: string[],
  agentIds: string[]
): Promise<{ integrationIds?: string[]; error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const entry = getCatalogEntry(catalogEntryId);
  if (!entry) {
    return { error: `Unknown catalog entry: ${catalogEntryId}` };
  }

  try {
    const entries: Array<{
      agentId?: string;
      departmentId?: string;
      type: string;
      provider: string;
      name: string;
      config?: Record<string, unknown>;
    }> = [];

    // Department targets: department_id set, agent_id null
    for (const departmentId of departmentIds) {
      entries.push({
        departmentId,
        type: entry.category,
        provider: entry.provider,
        name: entry.name,
        config: entry.defaultConfig,
      });
    }

    // Agent targets: agent_id set, department_id null
    for (const agentId of agentIds) {
      entries.push({
        agentId,
        type: entry.category,
        provider: entry.provider,
        name: entry.name,
        config: entry.defaultConfig,
      });
    }

    const created = await bulkCreateIntegrations(supabase, businessId, entries);

    revalidatePath(`/businesses/${businessId}/integrations`);
    // Also revalidate agent pages for targeted agents
    for (const agentId of agentIds) {
      revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
    }

    return { integrationIds: created.map((i) => i.id) };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to add catalog integration",
    };
  }
}

/**
 * Save (upsert) an integration for a specific agent and type.
 */
export async function saveIntegrationAction(
  businessId: string,
  agentId: string,
  type: string,
  provider: string,
  config?: Record<string, unknown>
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const effectiveStatus = provider.startsWith("mock") ? "mock" : "inactive";

  try {
    const { error } = await supabase
      .from("integrations")
      .upsert(
        {
          business_id: businessId,
          agent_id: agentId,
          type,
          provider,
          config: config ?? null,
          status: effectiveStatus,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "business_id,agent_id,type",
        }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Audit log (best-effort)
    try {
      await supabase.from("audit_logs").insert({
        business_id: businessId,
        action: "integration.configured",
        metadata: { agent_id: agentId, type, provider },
      });
    } catch {
      // best-effort
    }

    revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
    revalidatePath(`/businesses/${businessId}/integrations`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to save integration",
    };
  }
}

/**
 * Delete an integration by ID.
 */
export async function deleteIntegrationAction(
  businessId: string,
  integrationId: string
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const { error } = await supabase
      .from("integrations")
      .delete()
      .eq("id", integrationId)
      .eq("business_id", businessId);

    if (error) throw new Error(error.message);

    // Audit log (best-effort)
    try {
      await supabase.from("audit_logs").insert({
        business_id: businessId,
        action: "integration.deleted",
        metadata: { integrationId },
      });
    } catch {
      // best-effort
    }

    revalidatePath(`/businesses/${businessId}/integrations`);
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to delete integration",
    };
  }
}
