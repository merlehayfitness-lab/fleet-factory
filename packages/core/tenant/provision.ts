import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateBusinessInput } from "./schema";

/**
 * Provisions a complete business tenant via the Postgres RPC.
 *
 * This is a thin wrapper -- all logic lives in the provision_business_tenant()
 * SQL function which runs as a single atomic transaction. Keeps Server Actions
 * under 15 lines per research guidance.
 *
 * @param supabase - Authenticated Supabase client
 * @param input - Validated business creation input
 * @returns The new (or existing, if idempotent) business UUID
 * @throws Error if the RPC call fails
 */
export async function provisionBusinessTenant(
  supabase: SupabaseClient,
  input: CreateBusinessInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("provision_business_tenant", {
    p_name: input.name,
    p_slug: input.slug,
    p_industry: input.industry,
  });

  if (error) {
    throw new Error(`Provisioning failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("Provisioning returned no business ID");
  }

  return data as string;
}
