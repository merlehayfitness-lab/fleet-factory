"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { requireActiveBusiness } from "@/_lib/require-active-business";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSecrets,
  saveSecret,
  deleteSecret,
  getSecretsByProvider,
  revealSecret,
  saveProviderCredentials,
  deleteProviderSecrets,
  testConnection,
  decrypt,
} from "@fleet-factory/core/server";

// ---------------------------------------------------------------------------
// Legacy actions (backward compatible)
// ---------------------------------------------------------------------------

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

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

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

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

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

// ---------------------------------------------------------------------------
// Provider credential field actions (Phase 13)
// ---------------------------------------------------------------------------

interface CredentialField {
  id: string;
  provider: string;
  field_name: string;
  field_type: "password" | "text" | "url";
  display_label: string;
  placeholder: string | null;
  help_text: string | null;
  field_order: number;
}

/**
 * Get credential field definitions for a single provider.
 * Returns fields sorted by field_order.
 */
export async function getProviderFieldsAction(provider: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const { data, error } = await supabase
      .from("provider_credential_fields")
      .select("*")
      .eq("provider", provider)
      .order("field_order");

    if (error) {
      return { error: error.message };
    }

    return { fields: (data ?? []) as CredentialField[] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch provider fields",
    };
  }
}

/**
 * Get all credential field definitions grouped by provider.
 * Returns Record<string, CredentialField[]>.
 */
export async function getAllProviderFieldsAction() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const { data, error } = await supabase
      .from("provider_credential_fields")
      .select("*")
      .order("provider")
      .order("field_order");

    if (error) {
      return { error: error.message };
    }

    const grouped: Record<string, CredentialField[]> = {};
    for (const field of (data ?? []) as CredentialField[]) {
      if (!grouped[field.provider]) {
        grouped[field.provider] = [];
      }
      grouped[field.provider].push(field);
    }

    return { fields: grouped };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch all provider fields",
    };
  }
}

// ---------------------------------------------------------------------------
// Provider-scoped secret actions (Phase 13)
// ---------------------------------------------------------------------------

/**
 * Reveal (decrypt) a single secret server-side.
 * Returns the plaintext value.
 */
export async function revealSecretAction(businessId: string, secretId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const result = await revealSecret(supabase, businessId, secretId);
    return { value: result.value };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to reveal secret",
    };
  }
}

/**
 * Test connection for a provider using stored credentials.
 * Decrypts all secrets for the provider, then calls the test connection service.
 */
export async function testConnectionAction(businessId: string, provider: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    // Fetch secrets for this provider
    const { data: secrets, error } = await supabase
      .from("secrets")
      .select("*")
      .eq("business_id", businessId)
      .eq("provider", provider);

    if (error) {
      return { error: error.message };
    }

    if (!secrets || secrets.length === 0) {
      return { error: "No credentials found for this provider" };
    }

    // Decrypt credentials
    const decryptedCredentials: Record<string, string> = {};
    for (const secret of secrets) {
      try {
        decryptedCredentials[secret.key] = decrypt(secret.encrypted_value);
      } catch {
        return { error: `Failed to decrypt credential: ${secret.key}` };
      }
    }

    // Test connection
    const result = await testConnection(provider, decryptedCredentials);
    return result;
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Connection test failed",
    };
  }
}

/**
 * Save all credentials for a provider.
 * Encrypts, stores, and auto-manages integration record.
 */
export async function saveProviderCredentialsAction(
  businessId: string,
  provider: string,
  credentials: Record<string, string>
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    await saveProviderCredentials(supabase, businessId, provider, credentials);
    revalidatePath(`/businesses/${businessId}/settings`);
    revalidatePath(`/businesses/${businessId}/integrations`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save provider credentials",
    };
  }
}

/**
 * Delete all credentials for a provider.
 * Also deactivates the integration record.
 */
export async function deleteProviderSecretsAction(
  businessId: string,
  provider: string
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const guard = await requireActiveBusiness(businessId);
  if (guard) return guard;

  try {
    await deleteProviderSecrets(supabase, businessId, provider);
    revalidatePath(`/businesses/${businessId}/settings`);
    revalidatePath(`/businesses/${businessId}/integrations`);
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete provider secrets",
    };
  }
}

/**
 * Fetch secrets grouped by provider for a business.
 */
export async function getSecretsByProviderAction(businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const secrets = await getSecretsByProvider(supabase, businessId);
    return { secrets };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch secrets by provider",
    };
  }
}
