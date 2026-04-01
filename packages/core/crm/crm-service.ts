// High-level CRM service using Supabase as the primary store.
// All functions accept SupabaseClient as first argument (server-only pattern).
// The local database is the source of truth; use crm-sync.ts to synchronise
// with the remote Twenty CRM instance.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CrmContact,
  CrmDeal,
  CrmActivity,
  CrmPipelineSummary,
} from "./crm-types";

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

/**
 * List contacts for a business.
 * Ordered by created_at DESC. Supports optional status filter.
 */
export async function getContacts(
  supabase: SupabaseClient,
  businessId: string,
  opts?: { status?: CrmContact["status"]; limit?: number },
): Promise<CrmContact[]> {
  let query = supabase
    .from("crm_contacts")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.status) {
    query = query.eq("status", opts.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch CRM contacts: ${error.message}`);
  }

  return (data ?? []).map(rowToContact);
}

/**
 * Create a new contact for a business.
 * The new record will not have an external_id until it is synced to Twenty CRM.
 */
export async function createContact(
  supabase: SupabaseClient,
  businessId: string,
  payload: Omit<CrmContact, "id" | "businessId" | "externalId" | "createdAt" | "updatedAt">,
): Promise<CrmContact> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      business_id: businessId,
      external_id: null,
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone: payload.phone ?? null,
      company: payload.company ?? null,
      job_title: payload.jobTitle ?? null,
      source: payload.source,
      status: payload.status,
      score: payload.score ?? null,
      tags: payload.tags,
      metadata: payload.metadata,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create CRM contact: ${error?.message ?? "No data returned"}`,
    );
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "crm.contact_created",
      entity_type: "crm_contacts",
      entity_id: data.id as string,
      metadata: { email: payload.email, source: payload.source },
    });
  } catch {
    // Best-effort
  }

  return rowToContact(data);
}

/**
 * Update an existing contact.
 * Partial updates are supported; only provided fields are written.
 */
export async function updateContact(
  supabase: SupabaseClient,
  businessId: string,
  contactId: string,
  patch: Partial<
    Omit<CrmContact, "id" | "businessId" | "externalId" | "createdAt" | "updatedAt">
  >,
): Promise<CrmContact> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.firstName !== undefined) updatePayload.first_name = patch.firstName;
  if (patch.lastName !== undefined) updatePayload.last_name = patch.lastName;
  if (patch.email !== undefined) updatePayload.email = patch.email;
  if (patch.phone !== undefined) updatePayload.phone = patch.phone;
  if (patch.company !== undefined) updatePayload.company = patch.company;
  if (patch.jobTitle !== undefined) updatePayload.job_title = patch.jobTitle;
  if (patch.source !== undefined) updatePayload.source = patch.source;
  if (patch.status !== undefined) updatePayload.status = patch.status;
  if (patch.score !== undefined) updatePayload.score = patch.score;
  if (patch.tags !== undefined) updatePayload.tags = patch.tags;
  if (patch.metadata !== undefined) updatePayload.metadata = patch.metadata;

  const { data, error } = await supabase
    .from("crm_contacts")
    .update(updatePayload)
    .eq("id", contactId)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update CRM contact: ${error?.message ?? "No data returned"}`,
    );
  }

  return rowToContact(data);
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

/**
 * List deals for a business.
 * Ordered by created_at DESC. Supports optional stage filter.
 */
export async function getDeals(
  supabase: SupabaseClient,
  businessId: string,
  opts?: { stage?: CrmDeal["stage"]; contactId?: string; limit?: number },
): Promise<CrmDeal[]> {
  let query = supabase
    .from("crm_deals")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.stage) query = query.eq("stage", opts.stage);
  if (opts?.contactId) query = query.eq("contact_id", opts.contactId);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch CRM deals: ${error.message}`);
  }

  return (data ?? []).map(rowToDeal);
}

/**
 * Create a new deal linked to a contact.
 */
export async function createDeal(
  supabase: SupabaseClient,
  businessId: string,
  payload: Omit<CrmDeal, "id" | "businessId" | "createdAt" | "updatedAt">,
): Promise<CrmDeal> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("crm_deals")
    .insert({
      business_id: businessId,
      external_id: null,
      contact_id: payload.contactId,
      title: payload.title,
      value: payload.value,
      currency: payload.currency,
      stage: payload.stage,
      probability: payload.probability,
      expected_close_date: payload.expectedCloseDate ?? null,
      assigned_agent_id: payload.assignedAgentId ?? null,
      metadata: payload.metadata,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create CRM deal: ${error?.message ?? "No data returned"}`,
    );
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "crm.deal_created",
      entity_type: "crm_deals",
      entity_id: data.id as string,
      metadata: { title: payload.title, value: payload.value, stage: payload.stage },
    });
  } catch {
    // Best-effort
  }

  return rowToDeal(data);
}

/**
 * Advance (or regress) a deal's pipeline stage.
 * Also updates the probability field based on stage convention.
 */
export async function updateDealStage(
  supabase: SupabaseClient,
  businessId: string,
  dealId: string,
  stage: CrmDeal["stage"],
): Promise<CrmDeal> {
  const probability = DEFAULT_PROBABILITY[stage];

  const { data, error } = await supabase
    .from("crm_deals")
    .update({
      stage,
      probability,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update deal stage: ${error?.message ?? "No data returned"}`,
    );
  }

  // Activity log (best-effort)
  try {
    await supabase.from("crm_activities").insert({
      business_id: businessId,
      deal_id: dealId,
      type: "deal_update",
      subject: `Deal moved to ${stage}`,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Best-effort
  }

  return rowToDeal(data);
}

// ---------------------------------------------------------------------------
// Pipeline summary
// ---------------------------------------------------------------------------

/**
 * Compute a pipeline summary from the local crm_deals table.
 * Equivalent to TwentyCrmClient.getPipelineSummary() but uses local data.
 */
export async function getPipelineSummary(
  supabase: SupabaseClient,
  businessId: string,
): Promise<CrmPipelineSummary> {
  const { data: deals, error } = await supabase
    .from("crm_deals")
    .select("stage, value, updated_at")
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to compute pipeline summary: ${error.message}`);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const byStage: Record<string, { count: number; value: number }> = {};
  let wonThisMonth = 0;
  let lostThisMonth = 0;
  let totalValue = 0;

  for (const row of deals ?? []) {
    const stage = row.stage as string;
    const value = (row.value as number) ?? 0;
    const updatedAt = row.updated_at as string;

    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
    byStage[stage].count += 1;
    byStage[stage].value += value;
    totalValue += value;

    if (stage === "closed_won" && updatedAt >= monthStart) wonThisMonth += 1;
    if (stage === "closed_lost" && updatedAt >= monthStart) lostThisMonth += 1;
  }

  const closedTotal = wonThisMonth + lostThisMonth;
  const conversionRate = closedTotal > 0 ? wonThisMonth / closedTotal : 0;

  return {
    totalDeals: (deals ?? []).length,
    totalValue,
    byStage,
    wonThisMonth,
    lostThisMonth,
    conversionRate,
  };
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

/**
 * Get activities for a business, optionally filtered by contact or deal.
 * Ordered by created_at DESC.
 */
export async function getActivities(
  supabase: SupabaseClient,
  businessId: string,
  opts?: { contactId?: string; dealId?: string; limit?: number },
): Promise<CrmActivity[]> {
  let query = supabase
    .from("crm_activities")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);

  if (opts?.contactId) query = query.eq("contact_id", opts.contactId);
  if (opts?.dealId) query = query.eq("deal_id", opts.dealId);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch CRM activities: ${error.message}`);
  }

  return (data ?? []).map(rowToActivity);
}

/**
 * Log a CRM activity.
 * Agents call this to record interactions with contacts and deals.
 */
export async function logActivity(
  supabase: SupabaseClient,
  businessId: string,
  payload: Omit<CrmActivity, "id" | "businessId" | "createdAt">,
): Promise<CrmActivity> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("crm_activities")
    .insert({
      business_id: businessId,
      contact_id: payload.contactId ?? null,
      deal_id: payload.dealId ?? null,
      agent_id: payload.agentId ?? null,
      type: payload.type,
      subject: payload.subject,
      description: payload.description ?? null,
      created_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to log CRM activity: ${error?.message ?? "No data returned"}`,
    );
  }

  return rowToActivity(data);
}

// ---------------------------------------------------------------------------
// Internal row mappers
// ---------------------------------------------------------------------------

function rowToContact(row: Record<string, unknown>): CrmContact {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    externalId: (row.external_id as string) ?? undefined,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    phone: (row.phone as string) ?? undefined,
    company: (row.company as string) ?? undefined,
    jobTitle: (row.job_title as string) ?? undefined,
    source: (row.source as CrmContact["source"]) ?? "organic",
    status: (row.status as CrmContact["status"]) ?? "new",
    score: typeof row.score === "number" ? row.score : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToDeal(row: Record<string, unknown>): CrmDeal {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    contactId: row.contact_id as string,
    title: row.title as string,
    value: (row.value as number) ?? 0,
    currency: (row.currency as string) ?? "USD",
    stage: (row.stage as CrmDeal["stage"]) ?? "lead",
    probability: (row.probability as number) ?? 0,
    expectedCloseDate: (row.expected_close_date as string) ?? undefined,
    assignedAgentId: (row.assigned_agent_id as string) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToActivity(row: Record<string, unknown>): CrmActivity {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    contactId: (row.contact_id as string) ?? undefined,
    dealId: (row.deal_id as string) ?? undefined,
    agentId: (row.agent_id as string) ?? undefined,
    type: (row.type as CrmActivity["type"]) ?? "note",
    subject: row.subject as string,
    description: (row.description as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Default stage probabilities (conventional pipeline values)
// ---------------------------------------------------------------------------

const DEFAULT_PROBABILITY: Record<CrmDeal["stage"], number> = {
  lead: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  closed_won: 100,
  closed_lost: 0,
};
