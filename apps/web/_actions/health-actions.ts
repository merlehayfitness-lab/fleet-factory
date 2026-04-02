"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { getSystemHealth } from "@fleet-factory/core/server";
import type { SystemHealth } from "@fleet-factory/core/server";

/**
 * Fetch the combined health dashboard data for a business.
 *
 * Called by the HealthDashboard client component for polling refreshes.
 * This is a data-fetching action, not a mutation -- does NOT call redirect().
 */
export async function getHealthDashboard(
  businessId: string,
): Promise<{ data: SystemHealth } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const health = await getSystemHealth(supabase, businessId);
    return { data: health };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch health data",
    };
  }
}
