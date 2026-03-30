// Secrets CRUD service for managing encrypted credentials per business.
// Encryption/decryption uses AES-256-GCM from packages/core/crypto/encryption.

import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt, decrypt } from "../crypto/encryption";
import { INTEGRATION_CATALOG } from "../integrations/catalog";

interface Secret {
  id: string;
  business_id: string;
  key: string;
  encrypted_value: string;
  category: string;
  integration_type: string | null;
  provider: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all secrets for a business, ordered by category then key.
 * Returns encrypted values -- never exposes plaintext to the UI.
 */
export async function getSecrets(
  supabase: SupabaseClient,
  businessId: string
): Promise<Secret[]> {
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("business_id", businessId)
    .order("category")
    .order("key");

  if (error) {
    throw new Error(`Failed to fetch secrets: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Save (upsert) a secret for a business.
 * Encrypts the plain value before storage.
 * Uses the unique business_id + key constraint for upsert.
 */
export async function saveSecret(
  supabase: SupabaseClient,
  businessId: string,
  key: string,
  plainValue: string,
  category: string,
  integrationType?: string
): Promise<Secret> {
  const encryptedValue = encrypt(plainValue);

  const { data, error } = await supabase
    .from("secrets")
    .upsert(
      {
        business_id: businessId,
        key,
        encrypted_value: encryptedValue,
        category,
        integration_type: integrationType ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "business_id,key",
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save secret: ${error.message}`);
  }

  // Audit log
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "secret.saved",
      metadata: { key, category },
    });
  } catch {
    // Best-effort audit logging
    console.error("Failed to log secret save audit event");
  }

  return data;
}

/**
 * Delete a secret by ID and business ID.
 */
export async function deleteSecret(
  supabase: SupabaseClient,
  businessId: string,
  secretId: string
): Promise<void> {
  const { error } = await supabase
    .from("secrets")
    .delete()
    .eq("id", secretId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to delete secret: ${error.message}`);
  }

  // Audit log
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "secret.deleted",
      metadata: { secretId },
    });
  } catch {
    // Best-effort audit logging
    console.error("Failed to log secret delete audit event");
  }
}

/**
 * Decrypt all secrets for a business -- server-side only for deployment artifact generation.
 * Returns array of { key, decryptedValue } pairs.
 */
export async function decryptSecretsForDeployment(
  supabase: SupabaseClient,
  businessId: string
): Promise<Array<{ key: string; decryptedValue: string }>> {
  const secrets = await getSecrets(supabase, businessId);

  return secrets.map((secret) => ({
    key: secret.key,
    decryptedValue: decrypt(secret.encrypted_value),
  }));
}

// ---------------------------------------------------------------------------
// Provider-scoped secrets (Phase 13 additions)
// ---------------------------------------------------------------------------

/**
 * Fetch secrets grouped by provider.
 * Returns Record<string, Secret[]> where key is provider name.
 * Secrets with null provider go into a "legacy" group.
 */
export async function getSecretsByProvider(
  supabase: SupabaseClient,
  businessId: string
): Promise<Record<string, Secret[]>> {
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("business_id", businessId)
    .order("provider")
    .order("key");

  if (error) {
    throw new Error(`Failed to fetch secrets by provider: ${error.message}`);
  }

  const grouped: Record<string, Secret[]> = {};
  for (const secret of data ?? []) {
    const group = secret.provider ?? "legacy";
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(secret);
  }

  return grouped;
}

/**
 * Reveal (decrypt) a single secret by ID.
 * Returns the plaintext value. Server-side only.
 */
export async function revealSecret(
  supabase: SupabaseClient,
  businessId: string,
  secretId: string
): Promise<{ value: string }> {
  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("id", secretId)
    .eq("business_id", businessId)
    .single();

  if (error || !data) {
    throw new Error("Secret not found");
  }

  const value = decrypt(data.encrypted_value);
  return { value };
}

/**
 * Save all credentials for a provider.
 * Each credential entry is encrypted and upserted using the provider-scoped unique index.
 * Auto-creates or activates the integration record for this provider.
 */
export async function saveProviderCredentials(
  supabase: SupabaseClient,
  businessId: string,
  provider: string,
  credentials: Record<string, string>
): Promise<void> {
  // Upsert each credential field
  for (const [fieldName, plainValue] of Object.entries(credentials)) {
    if (!plainValue) continue; // Skip empty values

    const encryptedValue = encrypt(plainValue);

    const { error } = await supabase
      .from("secrets")
      .upsert(
        {
          business_id: businessId,
          provider,
          key: fieldName,
          encrypted_value: encryptedValue,
          category: "api_key",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "business_id,provider,key",
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save credential ${fieldName}: ${error.message}`);
    }
  }

  // Auto-create or activate integration record
  const catalogEntry = INTEGRATION_CATALOG.find((e) => e.provider === provider);
  const integrationType = catalogEntry?.category ?? "messaging";

  // Check if integration already exists for this provider + business
  const { data: existing } = await supabase
    .from("integrations")
    .select("id, status")
    .eq("business_id", businessId)
    .eq("provider", provider)
    .is("agent_id", null)
    .is("department_id", null)
    .maybeSingle();

  if (!existing) {
    // Create new integration record
    await supabase.from("integrations").insert({
      business_id: businessId,
      provider,
      type: integrationType,
      name: catalogEntry?.name ?? provider,
      status: "active",
    });
  } else if (existing.status === "inactive" || existing.status === "mock") {
    // Activate existing integration
    await supabase
      .from("integrations")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  // Audit log
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "secret.provider_credentials_saved",
      metadata: { provider },
    });
  } catch {
    console.error("Failed to log provider credentials save audit event");
  }
}

/**
 * Delete all secrets for a provider in a business.
 * Sets the integration record to 'mock' status.
 */
export async function deleteProviderSecrets(
  supabase: SupabaseClient,
  businessId: string,
  provider: string
): Promise<void> {
  const { error } = await supabase
    .from("secrets")
    .delete()
    .eq("business_id", businessId)
    .eq("provider", provider);

  if (error) {
    throw new Error(`Failed to delete provider secrets: ${error.message}`);
  }

  // Set integration to mock
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("business_id", businessId)
    .eq("provider", provider)
    .is("agent_id", null)
    .is("department_id", null)
    .maybeSingle();

  if (integration) {
    await supabase
      .from("integrations")
      .update({ status: "mock", updated_at: new Date().toISOString() })
      .eq("id", integration.id);
  }

  // Audit log
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "secret.provider_credentials_deleted",
      metadata: { provider },
    });
  } catch {
    console.error("Failed to log provider credentials delete audit event");
  }
}
