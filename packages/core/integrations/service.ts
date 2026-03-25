// Integrations CRUD service for managing per-agent integration configuration.
// Follows the same pattern as secrets/service.ts from 03-03.

import type { SupabaseClient } from "@supabase/supabase-js";

interface Integration {
  id: string;
  business_id: string;
  agent_id: string;
  type: string;
  provider: string;
  config: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface IntegrationWithAgent extends Integration {
  agents: { id: string; name: string } | null;
}

/**
 * Fetch all integrations for a specific agent, ordered by type.
 */
export async function getIntegrationsForAgent(
  supabase: SupabaseClient,
  agentId: string
): Promise<Integration[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("agent_id", agentId)
    .order("type");

  if (error) {
    throw new Error(`Failed to fetch agent integrations: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch all integrations for a business with agent names, ordered by type then agent.
 */
export async function getIntegrationsForBusiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<IntegrationWithAgent[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("*, agents(id, name)")
    .eq("business_id", businessId)
    .order("type")
    .order("created_at");

  if (error) {
    throw new Error(`Failed to fetch business integrations: ${error.message}`);
  }

  return (data ?? []) as IntegrationWithAgent[];
}

/**
 * Upsert an integration record for a given agent and type.
 * If an integration with the same business_id + agent_id + type exists, update it.
 * Otherwise insert a new record.
 */
export async function upsertIntegration(
  supabase: SupabaseClient,
  businessId: string,
  agentId: string,
  type: string,
  provider: string,
  config?: Record<string, unknown>,
  status?: string
): Promise<Integration> {
  const effectiveStatus =
    status ?? (provider.startsWith("mock") ? "mock" : "inactive");

  const { data, error } = await supabase
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

  if (error) {
    throw new Error(`Failed to upsert integration: ${error.message}`);
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "integration.configured",
      entity_type: "integration",
      entity_id: data.id,
      metadata: { agent_id: agentId, type, provider },
    });
  } catch {
    console.error("Failed to log integration configure audit event");
  }

  return data;
}

/**
 * Delete an integration by ID and business ID.
 */
export async function deleteIntegration(
  supabase: SupabaseClient,
  businessId: string,
  integrationId: string
): Promise<void> {
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("id", integrationId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to delete integration: ${error.message}`);
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "integration.deleted",
      entity_type: "integration",
      entity_id: integrationId,
      metadata: { integrationId },
    });
  } catch {
    console.error("Failed to log integration delete audit event");
  }
}
