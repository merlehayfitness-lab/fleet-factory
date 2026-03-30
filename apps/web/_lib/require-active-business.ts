import { createServerClient } from "@/_lib/supabase/server";

/**
 * Server Action guard: blocks mutations when business is disabled or suspended.
 * Call at the top of every mutation Server Action BEFORE any writes.
 *
 * Returns null if business is active (safe to proceed).
 * Returns { error: string } if business is disabled/suspended (abort mutation).
 *
 * EXEMPT actions (do NOT use this guard):
 * - restoreTenantAction (must work on disabled businesses)
 * - restoreAgentEmergency (must work on disabled businesses)
 * - All read-only actions (getters, list, fetch)
 */
export async function requireActiveBusiness(
  businessId: string,
): Promise<{ error: string } | null> {
  const supabase = await createServerClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("status")
    .eq("id", businessId)
    .single();

  if (!business) {
    return { error: "Business not found." };
  }

  if (business.status === "disabled" || business.status === "suspended") {
    return {
      error:
        "Business is suspended. No changes can be made until it is restored.",
    };
  }

  return null;
}
