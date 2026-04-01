// CRM sync service: bidirectional sync between Twenty CRM and Supabase.
// Strategy: last-write-wins based on updatedAt timestamps.
// All functions accept SupabaseClient as first argument (server-only pattern).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TwentyCrmConfig, CrmContact, CrmDeal } from "./crm-types";
import { createTwentyCrmClient } from "./crm-client";

// ---------------------------------------------------------------------------
// Sync result shape
// ---------------------------------------------------------------------------

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Contacts sync
// ---------------------------------------------------------------------------

/**
 * Pull contacts from Twenty CRM and upsert them into the local `crm_contacts`
 * table for the given business.
 *
 * Conflict resolution: if the remote record has a newer `updated_at` than the
 * local record, the local record is overwritten (last-write-wins).
 *
 * TODO: Replace `crm_contacts` table name once Supabase schema migration is
 * applied that creates this table.
 */
export async function syncContactsFromCrm(
  supabase: SupabaseClient,
  businessId: string,
  config: TwentyCrmConfig,
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const client = createTwentyCrmClient(config);

  let cursor: string | undefined;

  do {
    let page: { data: CrmContact[]; nextCursor?: string };

    try {
      page = await client.listContacts({ limit: 100, cursor });
    } catch (err) {
      result.errors.push(`Failed to fetch page from Twenty CRM: ${String(err)}`);
      break;
    }

    for (const contact of page.data) {
      try {
        // Fetch existing local record by external_id
        const { data: existing } = await supabase
          .from("crm_contacts")
          .select("id, updated_at")
          .eq("business_id", businessId)
          .eq("external_id", contact.id)
          .maybeSingle();

        const remoteUpdatedAt = contact.updatedAt;

        if (!existing) {
          // Insert new local record
          const { error: insertErr } = await supabase.from("crm_contacts").insert({
            business_id: businessId,
            external_id: contact.id,
            first_name: contact.firstName,
            last_name: contact.lastName,
            email: contact.email,
            phone: contact.phone ?? null,
            company: contact.company ?? null,
            job_title: contact.jobTitle ?? null,
            source: contact.source,
            status: contact.status,
            score: contact.score ?? null,
            tags: contact.tags,
            metadata: contact.metadata,
            created_at: contact.createdAt,
            updated_at: remoteUpdatedAt,
            synced_at: new Date().toISOString(),
          });

          if (insertErr) {
            result.errors.push(
              `Insert failed for contact ${contact.id}: ${insertErr.message}`,
            );
          } else {
            result.created += 1;
          }
        } else {
          // Last-write-wins: skip if local record is newer or equal
          if (existing.updated_at >= remoteUpdatedAt) {
            result.skipped += 1;
            continue;
          }

          const { error: updateErr } = await supabase
            .from("crm_contacts")
            .update({
              first_name: contact.firstName,
              last_name: contact.lastName,
              email: contact.email,
              phone: contact.phone ?? null,
              company: contact.company ?? null,
              job_title: contact.jobTitle ?? null,
              source: contact.source,
              status: contact.status,
              score: contact.score ?? null,
              tags: contact.tags,
              metadata: contact.metadata,
              updated_at: remoteUpdatedAt,
              synced_at: new Date().toISOString(),
            })
            .eq("id", existing.id as string);

          if (updateErr) {
            result.errors.push(
              `Update failed for contact ${contact.id}: ${updateErr.message}`,
            );
          } else {
            result.updated += 1;
          }
        }
      } catch (err) {
        result.errors.push(`Unexpected error for contact ${contact.id}: ${String(err)}`);
      }
    }

    cursor = page.nextCursor;
  } while (cursor);

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "crm.contacts_synced",
      entity_type: "crm_contacts",
      entity_id: businessId,
      metadata: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    });
  } catch {
    // Best-effort audit log
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pipeline (deals) sync
// ---------------------------------------------------------------------------

/**
 * Pull deals from Twenty CRM and upsert them into the local `crm_deals` table.
 * Same last-write-wins conflict resolution as contacts sync.
 *
 * TODO: Replace `crm_deals` table name once Supabase schema migration is applied.
 */
export async function syncPipelineFromCrm(
  supabase: SupabaseClient,
  businessId: string,
  config: TwentyCrmConfig,
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const client = createTwentyCrmClient(config);

  let cursor: string | undefined;

  do {
    let page: { data: CrmDeal[]; nextCursor?: string };

    try {
      page = await client.listDeals({ limit: 100, cursor });
    } catch (err) {
      result.errors.push(`Failed to fetch deals page from Twenty CRM: ${String(err)}`);
      break;
    }

    for (const deal of page.data) {
      try {
        const { data: existing } = await supabase
          .from("crm_deals")
          .select("id, updated_at")
          .eq("business_id", businessId)
          .eq("external_id", deal.id)
          .maybeSingle();

        const remoteUpdatedAt = deal.updatedAt;

        if (!existing) {
          const { error: insertErr } = await supabase.from("crm_deals").insert({
            business_id: businessId,
            external_id: deal.id,
            contact_id: deal.contactId,
            title: deal.title,
            value: deal.value,
            currency: deal.currency,
            stage: deal.stage,
            probability: deal.probability,
            expected_close_date: deal.expectedCloseDate ?? null,
            assigned_agent_id: deal.assignedAgentId ?? null,
            metadata: deal.metadata,
            created_at: deal.createdAt,
            updated_at: remoteUpdatedAt,
            synced_at: new Date().toISOString(),
          });

          if (insertErr) {
            result.errors.push(
              `Insert failed for deal ${deal.id}: ${insertErr.message}`,
            );
          } else {
            result.created += 1;
          }
        } else {
          if (existing.updated_at >= remoteUpdatedAt) {
            result.skipped += 1;
            continue;
          }

          const { error: updateErr } = await supabase
            .from("crm_deals")
            .update({
              title: deal.title,
              value: deal.value,
              currency: deal.currency,
              stage: deal.stage,
              probability: deal.probability,
              expected_close_date: deal.expectedCloseDate ?? null,
              assigned_agent_id: deal.assignedAgentId ?? null,
              metadata: deal.metadata,
              updated_at: remoteUpdatedAt,
              synced_at: new Date().toISOString(),
            })
            .eq("id", existing.id as string);

          if (updateErr) {
            result.errors.push(
              `Update failed for deal ${deal.id}: ${updateErr.message}`,
            );
          } else {
            result.updated += 1;
          }
        }
      } catch (err) {
        result.errors.push(`Unexpected error for deal ${deal.id}: ${String(err)}`);
      }
    }

    cursor = page.nextCursor;
  } while (cursor);

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "crm.pipeline_synced",
      entity_type: "crm_deals",
      entity_id: businessId,
      metadata: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    });
  } catch {
    // Best-effort audit log
  }

  return result;
}

// ---------------------------------------------------------------------------
// Outbound sync: push agent-created contacts to Twenty CRM
// ---------------------------------------------------------------------------

/**
 * Push locally-created contacts (those without an external_id) to Twenty CRM,
 * then write back the external_id assigned by Twenty.
 *
 * This completes the bidirectional sync loop so contacts created by agents
 * are visible in the CRM UI.
 */
export async function pushLocalContactsToCrm(
  supabase: SupabaseClient,
  businessId: string,
  config: TwentyCrmConfig,
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const client = createTwentyCrmClient(config);

  const { data: localContacts, error: fetchErr } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("business_id", businessId)
    .is("external_id", null);

  if (fetchErr) {
    result.errors.push(`Failed to fetch unsynced contacts: ${fetchErr.message}`);
    return result;
  }

  for (const row of localContacts ?? []) {
    try {
      const created = await client.createContact({
        externalId: undefined,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        email: row.email as string,
        phone: (row.phone as string) ?? undefined,
        company: (row.company as string) ?? undefined,
        jobTitle: (row.job_title as string) ?? undefined,
        source: (row.source as CrmContact["source"]) ?? "organic",
        status: (row.status as CrmContact["status"]) ?? "new",
        score: (row.score as number) ?? undefined,
        tags: (row.tags as string[]) ?? [],
        metadata: (row.metadata as Record<string, unknown>) ?? {},
      });

      // Write back the external_id assigned by Twenty
      await supabase
        .from("crm_contacts")
        .update({
          external_id: created.id,
          synced_at: new Date().toISOString(),
        })
        .eq("id", row.id as string);

      result.created += 1;
    } catch (err) {
      result.errors.push(
        `Failed to push contact ${String(row.id)} to Twenty: ${String(err)}`,
      );
    }
  }

  return result;
}
