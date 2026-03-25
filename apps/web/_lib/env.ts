/**
 * Environment variable helpers.
 * All env var access goes through these functions (per CLAUDE.md rule).
 * Throws at runtime if a required variable is missing.
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
        "Add it to .env.local or your deployment environment.",
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
        "Add it to .env.local or your deployment environment.",
    );
  }
  return key;
}

/**
 * Server-only. Never expose this key to the client.
 * The service role key bypasses RLS -- use only for admin operations.
 */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "This key is server-only and must never be exposed to the client.",
    );
  }
  return key;
}

/**
 * Server-only. Used for encrypting/decrypting tenant secrets.
 * Optional in development -- returns empty string if not set to allow
 * deployment pipeline to run without real encryption.
 */
export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn(
      "ENCRYPTION_KEY not set. Secrets encryption will not work. " +
        "Set a 64-character hex string in .env.local for production use.",
    );
    return "";
  }
  return key;
}
