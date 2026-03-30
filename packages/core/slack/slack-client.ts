// Slack WebClient factory.
// Creates a WebClient from a bot token, or fetches the encrypted token from secrets.

import { WebClient } from "@slack/web-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../crypto/encryption";

/**
 * Create a Slack WebClient from a plaintext bot token.
 * Simple factory with no database dependency.
 */
export function createSlackClient(botToken: string): WebClient {
  return new WebClient(botToken);
}

/**
 * Fetch the encrypted bot token from the secrets table, decrypt it,
 * and return a configured WebClient.
 * Returns null if no Slack bot token is stored for this business.
 */
export async function getSlackClient(
  supabase: SupabaseClient,
  businessId: string,
): Promise<WebClient | null> {
  const { data: secret } = await supabase
    .from("secrets")
    .select("encrypted_value")
    .eq("business_id", businessId)
    .eq("provider", "slack")
    .eq("key", "bot_token")
    .single();

  if (!secret) return null;

  const botToken = decrypt(secret.encrypted_value as string);
  return new WebClient(botToken);
}
