"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import {
  checkVpsHealth,
  updateVpsStatus,
  getVpsStatus,
} from "@fleet-factory/core/server";

/**
 * Check VPS health by pinging the VPS API and persisting the result.
 * Returns the current health status.
 */
export async function checkVpsHealthAction() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const healthResult = await checkVpsHealth();
    // Persist the health status to the database (best-effort, don't fail if DB write errors)
    try {
      await updateVpsStatus(supabase, {
        status: healthResult.status,
        details: healthResult.details as Record<string, unknown> | undefined,
      });
    } catch {
      // DB write failed (e.g., RLS policy) -- continue with the health result
    }
    return {
      status: healthResult.status,
      lastCheckedAt: healthResult.timestamp,
      agentCount: healthResult.agentCount,
      details: healthResult.details as Record<string, unknown> | undefined,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to check VPS health",
    };
  }
}

/**
 * Get the current VPS status from the database (no VPS API call).
 * Returns the last-known status or null if VPS has never been checked.
 */
export async function getVpsStatusAction() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const status = await getVpsStatus(supabase);
    if (!status) {
      return { status: null };
    }
    return {
      status: {
        status: status.status,
        lastCheckedAt: status.last_checked_at,
        details: status.details,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to get VPS status",
    };
  }
}
