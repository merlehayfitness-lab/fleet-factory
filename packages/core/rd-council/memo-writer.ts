/**
 * R&D Council memo writer.
 *
 * Writes structured memos to the rd_memos table.
 * Handles creating, querying, and managing memo lifecycle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CouncilMemo } from "./council-types";

// ---------------------------------------------------------------------------
// Write memo
// ---------------------------------------------------------------------------

/**
 * Write a council memo to the database.
 */
export async function writeMemo(
  supabase: SupabaseClient,
  memo: CouncilMemo,
): Promise<CouncilMemo> {
  const { error } = await supabase.from("rd_memos").insert({
    session_id: memo.sessionId,
    business_id: memo.businessId ?? null,
    title: memo.title,
    summary: memo.summary,
    content: memo.content,
    proposer_agent: memo.proposerAgent,
    participants: memo.participants,
    votes: memo.votes,
    tags: memo.tags,
    status: "published",
    session_type: "scheduled",
    context_refs: memo.contextRefs,
  });

  if (error) {
    throw new Error(`Failed to write memo: ${error.message}`);
  }

  return memo;
}

// ---------------------------------------------------------------------------
// Query memos
// ---------------------------------------------------------------------------

/**
 * Get memos for a business (or system-level memos if businessId is null).
 */
export async function getMemos(
  supabase: SupabaseClient,
  businessId?: string,
  options?: { limit?: number; status?: string },
): Promise<Array<{
  id: string;
  sessionId: string;
  title: string;
  summary: string;
  proposerAgent: string;
  participants: unknown[];
  votes: Record<string, unknown>;
  tags: string[];
  status: string;
  createdAt: string;
}>> {
  let query = supabase
    .from("rd_memos")
    .select("id, session_id, title, summary, proposer_agent, participants, votes, tags, status, created_at")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 20);

  if (businessId) {
    query = query.eq("business_id", businessId);
  } else {
    query = query.is("business_id", null);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch memos: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    summary: row.summary,
    proposerAgent: row.proposer_agent,
    participants: row.participants as unknown[],
    votes: row.votes as Record<string, unknown>,
    tags: row.tags,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/**
 * Get a single memo by ID with full content.
 */
export async function getMemoById(
  supabase: SupabaseClient,
  memoId: string,
): Promise<{
  id: string;
  sessionId: string;
  title: string;
  summary: string;
  content: string;
  proposerAgent: string;
  participants: unknown[];
  votes: Record<string, unknown>;
  tags: string[];
  status: string;
  contextRefs: Record<string, unknown>;
  createdAt: string;
} | null> {
  const { data, error } = await supabase
    .from("rd_memos")
    .select("*")
    .eq("id", memoId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch memo: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    sessionId: data.session_id,
    title: data.title,
    summary: data.summary,
    content: data.content,
    proposerAgent: data.proposer_agent,
    participants: data.participants as unknown[],
    votes: data.votes as Record<string, unknown>,
    tags: data.tags,
    status: data.status,
    contextRefs: data.context_refs as Record<string, unknown>,
    createdAt: data.created_at,
  };
}

/**
 * Get the previous memo (for context injection into next session).
 */
export async function getPreviousMemo(
  supabase: SupabaseClient,
  businessId?: string,
): Promise<{ id: string; summary: string } | null> {
  let query = supabase
    .from("rd_memos")
    .select("id, summary")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data } = await query;
  return data?.[0] ?? null;
}

/**
 * Get total session count (for round-robin proposer selection).
 */
export async function getSessionCount(
  supabase: SupabaseClient,
  businessId?: string,
): Promise<number> {
  let query = supabase
    .from("rd_memos")
    .select("*", { count: "exact", head: true });

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { count } = await query;
  return count ?? 0;
}
