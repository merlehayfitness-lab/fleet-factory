// Secrets CRUD service for managing encrypted credentials per business.
// Encryption/decryption uses AES-256-GCM from packages/core/crypto/encryption.

import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt, decrypt } from "../crypto/encryption";

interface Secret {
  id: string;
  business_id: string;
  key: string;
  encrypted_value: string;
  category: string;
  integration_type: string | null;
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
