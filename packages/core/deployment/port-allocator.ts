/**
 * Port allocation service for VPS tenant containers.
 *
 * Allocates blocks of 100 ports per business starting at 4000.
 * Uses port_allocations table with Supabase RPC for atomic allocation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortAllocation {
  id: string;
  businessId: string;
  portRangeStart: number;
  portRangeEnd: number;
  allocatedAt: string;
  releasedAt: string | null;
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Allocate a port block for a business.
 * Uses the database RPC function for atomic allocation.
 * Returns existing allocation if one already exists (idempotent).
 */
export async function allocatePortBlock(
  supabase: SupabaseClient,
  businessId: string,
): Promise<PortAllocation> {
  const { data, error } = await supabase.rpc("allocate_port_block", {
    p_business_id: businessId,
  });

  if (error) {
    throw new Error(`Failed to allocate port block: ${error.message}`);
  }

  return mapRow(data);
}

/**
 * Get the current port allocation for a business.
 * Returns null if no allocation exists.
 */
export async function getBusinessPorts(
  supabase: SupabaseClient,
  businessId: string,
): Promise<PortAllocation | null> {
  const { data, error } = await supabase
    .from("port_allocations")
    .select("*")
    .eq("business_id", businessId)
    .is("released_at", null)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get port allocation: ${error.message}`);
  }

  return data ? mapRow(data) : null;
}

/**
 * Release the port block for a business.
 * Marks as released but doesn't delete (for audit trail).
 */
export async function releasePortBlock(
  supabase: SupabaseClient,
  businessId: string,
): Promise<void> {
  const { error } = await supabase
    .from("port_allocations")
    .update({ released_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .is("released_at", null);

  if (error) {
    throw new Error(`Failed to release port block: ${error.message}`);
  }
}

/**
 * Get a specific port for an agent within the business's allocated range.
 * Uses a deterministic offset based on agent index.
 */
export function getAgentPort(
  allocation: PortAllocation,
  agentIndex: number,
): number {
  const port = allocation.portRangeStart + agentIndex;
  if (port > allocation.portRangeEnd) {
    throw new Error(
      `Agent index ${agentIndex} exceeds port block capacity (${allocation.portRangeEnd - allocation.portRangeStart + 1} ports)`,
    );
  }
  return port;
}

/**
 * Get all active port allocations (for admin dashboards).
 */
export async function getAllPortAllocations(
  supabase: SupabaseClient,
): Promise<PortAllocation[]> {
  const { data, error } = await supabase
    .from("port_allocations")
    .select("*")
    .is("released_at", null)
    .order("port_range_start", { ascending: true });

  if (error) {
    throw new Error(`Failed to list port allocations: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRow(row: Record<string, unknown>): PortAllocation {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    portRangeStart: row.port_range_start as number,
    portRangeEnd: row.port_range_end as number,
    allocatedAt: row.allocated_at as string,
    releasedAt: (row.released_at as string) ?? null,
  };
}
