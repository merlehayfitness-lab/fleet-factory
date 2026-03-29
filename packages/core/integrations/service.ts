// Integrations CRUD service for managing per-agent and per-department integration configuration.
// Follows the same pattern as secrets/service.ts from 03-03.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Integration {
  id: string;
  business_id: string;
  agent_id: string | null;
  department_id?: string | null;
  type: string;
  provider: string;
  name?: string | null;
  config: Record<string, unknown> | null;
  status: string;
  setup_instructions?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationWithAgent extends Integration {
  agents: { id: string; name: string } | null;
}

export interface IntegrationWithDepartment extends IntegrationWithAgent {
  departments: { id: string; name: string } | null;
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
 * Fetch all integrations assigned at the department level.
 */
export async function getIntegrationsForDepartment(
  supabase: SupabaseClient,
  departmentId: string
): Promise<Integration[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("department_id", departmentId)
    .is("agent_id", null)
    .order("type");

  if (error) {
    throw new Error(`Failed to fetch department integrations: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get effective integrations for an agent: agent-level + department-level inherited.
 */
export async function getEffectiveIntegrationsForAgent(
  supabase: SupabaseClient,
  agentId: string,
  departmentId: string,
  businessId: string
): Promise<Integration[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("business_id", businessId)
    .or(`agent_id.eq.${agentId},and(department_id.eq.${departmentId},agent_id.is.null)`)
    .order("type");

  if (error) {
    throw new Error(`Failed to fetch effective integrations: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch all integrations for a business with agent and department names, ordered by type then created_at.
 */
export async function getIntegrationsForBusiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<IntegrationWithDepartment[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("*, agents(id, name), departments(id, name)")
    .eq("business_id", businessId)
    .order("type")
    .order("created_at");

  if (error) {
    throw new Error(`Failed to fetch business integrations: ${error.message}`);
  }

  return (data ?? []) as IntegrationWithDepartment[];
}

/**
 * Upsert an integration record for a given agent/department and type.
 * Uses check-then-insert pattern since partial indexes don't work cleanly with Supabase upsert.
 */
export async function upsertIntegration(
  supabase: SupabaseClient,
  businessId: string,
  agentId: string | null,
  type: string,
  provider: string,
  config?: Record<string, unknown>,
  status?: string,
  departmentId?: string | null,
  name?: string | null
): Promise<Integration> {
  const effectiveStatus =
    status ?? (provider.startsWith("mock") ? "mock" : "inactive");

  // Build match query
  let query = supabase
    .from("integrations")
    .select("id")
    .eq("business_id", businessId)
    .eq("type", type);

  if (agentId) {
    query = query.eq("agent_id", agentId);
  } else if (departmentId) {
    query = query.eq("department_id", departmentId).is("agent_id", null);
  }

  const { data: existing } = await query.maybeSingle();

  const record = {
    business_id: businessId,
    agent_id: agentId ?? null,
    department_id: departmentId ?? null,
    type,
    provider,
    name: name ?? null,
    config: config ?? null,
    status: effectiveStatus,
    updated_at: new Date().toISOString(),
  };

  let data: Integration;

  if (existing) {
    const { data: updated, error } = await supabase
      .from("integrations")
      .update(record)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update integration: ${error.message}`);
    }
    data = updated;
  } else {
    const { data: inserted, error } = await supabase
      .from("integrations")
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert integration: ${error.message}`);
    }
    data = inserted;
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "integration.configured",
      entity_type: "integration",
      entity_id: data.id,
      metadata: { agent_id: agentId, department_id: departmentId, type, provider },
    });
  } catch {
    console.error("Failed to log integration configure audit event");
  }

  return data;
}

/**
 * Bulk create integration records. Uses check-then-insert pattern to skip duplicates.
 */
export async function bulkCreateIntegrations(
  supabase: SupabaseClient,
  businessId: string,
  entries: Array<{
    agentId?: string;
    departmentId?: string;
    type: string;
    provider: string;
    name: string;
    config?: Record<string, unknown>;
  }>
): Promise<Integration[]> {
  if (entries.length === 0) return [];

  // Query existing integrations to skip duplicates
  const { data: existingData } = await supabase
    .from("integrations")
    .select("agent_id, department_id, type")
    .eq("business_id", businessId);

  const existingSet = new Set(
    (existingData ?? []).map(
      (e) => `${e.agent_id ?? ""}|${e.department_id ?? ""}|${e.type}`
    )
  );

  const toInsert = entries
    .filter((entry) => {
      const key = `${entry.agentId ?? ""}|${entry.departmentId ?? ""}|${entry.type}`;
      return !existingSet.has(key);
    })
    .map((entry) => ({
      business_id: businessId,
      agent_id: entry.agentId ?? null,
      department_id: entry.departmentId ?? null,
      type: entry.type,
      provider: entry.provider,
      name: entry.name,
      config: entry.config ?? null,
      status: entry.provider.startsWith("mock") ? "mock" : "inactive",
    }));

  if (toInsert.length === 0) return [];

  const { data, error } = await supabase
    .from("integrations")
    .insert(toInsert)
    .select();

  if (error) {
    throw new Error(`Failed to bulk create integrations: ${error.message}`);
  }

  // Audit log (best-effort)
  try {
    for (const record of data ?? []) {
      await supabase.from("audit_logs").insert({
        business_id: businessId,
        action: "integration.configured",
        entity_type: "integration",
        entity_id: record.id,
        metadata: {
          agent_id: record.agent_id,
          department_id: record.department_id,
          type: record.type,
          provider: record.provider,
          bulk: true,
        },
      });
    }
  } catch {
    console.error("Failed to log bulk integration audit events");
  }

  return (data ?? []) as Integration[];
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
