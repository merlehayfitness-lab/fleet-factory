"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";

/** Audit log entry shape for client consumption */
export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Filters for audit log queries */
export interface AuditLogFilters {
  actor?: string;
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
  entityType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch audit logs for a business with optional filters.
 */
export async function getAuditLogs(
  businessId: string,
  filters?: AuditLogFilters,
): Promise<
  { logs: AuditLogEntry[]; totalCount: number } | { error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    // Build count query
    let countQuery = supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);

    // Build data query
    let dataQuery = supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply optional filters to both queries
    if (filters?.eventType) {
      countQuery = countQuery.ilike("action", `%${filters.eventType}%`);
      dataQuery = dataQuery.ilike("action", `%${filters.eventType}%`);
    }

    if (filters?.entityType) {
      countQuery = countQuery.eq("entity_type", filters.entityType);
      dataQuery = dataQuery.eq("entity_type", filters.entityType);
    }

    if (filters?.actor) {
      countQuery = countQuery.eq("actor_id", filters.actor);
      dataQuery = dataQuery.eq("actor_id", filters.actor);
    }

    if (filters?.dateFrom) {
      countQuery = countQuery.gte("created_at", filters.dateFrom);
      dataQuery = dataQuery.gte("created_at", filters.dateFrom);
    }

    if (filters?.dateTo) {
      countQuery = countQuery.lte("created_at", filters.dateTo);
      dataQuery = dataQuery.lte("created_at", filters.dateTo);
    }

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      // Search across action and metadata text
      countQuery = countQuery.or(
        `action.ilike.${searchPattern},metadata::text.ilike.${searchPattern}`,
      );
      dataQuery = dataQuery.or(
        `action.ilike.${searchPattern},metadata::text.ilike.${searchPattern}`,
      );
    }

    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    const logs: AuditLogEntry[] = (dataResult.data ?? []).map(
      (row: {
        id: string;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        actor_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        actorId: row.actor_id,
        metadata: row.metadata ?? {},
        createdAt: row.created_at,
      }),
    );

    return { logs, totalCount: countResult.count ?? 0 };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch audit logs",
    };
  }
}

/**
 * Export audit logs for download (no pagination limit).
 * Returns raw data -- CSV/JSON conversion happens client-side.
 */
export async function exportAuditLogs(
  businessId: string,
  filters?: Omit<AuditLogFilters, "limit" | "offset">,
): Promise<{ data: AuditLogEntry[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    let query = supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (filters?.eventType) {
      query = query.ilike("action", `%${filters.eventType}%`);
    }
    if (filters?.entityType) {
      query = query.eq("entity_type", filters.entityType);
    }
    if (filters?.actor) {
      query = query.eq("actor_id", filters.actor);
    }
    if (filters?.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte("created_at", filters.dateTo);
    }
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      query = query.or(
        `action.ilike.${searchPattern},metadata::text.ilike.${searchPattern}`,
      );
    }

    const { data } = await query;

    const logs: AuditLogEntry[] = (data ?? []).map(
      (row: {
        id: string;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        actor_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        actorId: row.actor_id,
        metadata: row.metadata ?? {},
        createdAt: row.created_at,
      }),
    );

    return { data: logs };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to export audit logs",
    };
  }
}
