"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import {
  createBusinessSchema,
  provisionBusinessTenant,
} from "@agency-factory/core";

/**
 * Creates a new business tenant via the atomic provisioning RPC.
 *
 * Validates input with Zod, verifies authentication, then delegates
 * all provisioning logic to the Postgres RPC function.
 */
export async function createBusiness(formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const parsed = createBusinessSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    industry: formData.get("industry"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const businessId = await provisionBusinessTenant(supabase, parsed.data);
    redirect(`/businesses/${businessId}`);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Provisioning failed",
    };
  }
}
