"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSecrets,
  saveSecret,
  deleteSecret,
} from "@agency-factory/core/server";

/**
 * Fetch all secrets for a business.
 */
export async function getSecretsAction(businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const secrets = await getSecrets(supabase, businessId);
    return { secrets };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch secrets",
    };
  }
}

/**
 * Save (upsert) a secret for a business.
 * Encrypts the plain value server-side before storage.
 */
export async function saveSecretAction(
  businessId: string,
  key: string,
  value: string,
  category: string,
  integrationType?: string
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await saveSecret(supabase, businessId, key, value, category, integrationType);
    revalidatePath(`/businesses/${businessId}/settings/secrets`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save secret",
    };
  }
}

/**
 * Delete a secret for a business.
 */
export async function deleteSecretAction(
  businessId: string,
  secretId: string
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await deleteSecret(supabase, businessId, secretId);
    revalidatePath(`/businesses/${businessId}/settings/secrets`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete secret",
    };
  }
}
