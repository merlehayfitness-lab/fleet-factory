// Slack Events API signature verification and event parsing.
// Uses Node.js crypto for HMAC-SHA256 verification with timing-safe comparison.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../crypto/encryption";
import type { SlackEventPayload, SlackMessageEvent } from "./slack-types";

/**
 * Verify a Slack request signature using HMAC-SHA256.
 * Includes replay attack protection (rejects requests older than 5 minutes).
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  // Replay attack protection: reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac("sha256", signingSecret);
  hmac.update(sigBaseString);
  const computedSignature = `v0=${hmac.digest("hex")}`;

  // Timing-safe comparison requires equal-length buffers
  const computed = Buffer.from(computedSignature);
  const provided = Buffer.from(signature);

  if (computed.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(computed, provided);
}

/**
 * Parse a raw Slack event payload from the request body.
 */
export function parseSlackEvent(rawBody: string): SlackEventPayload {
  return JSON.parse(rawBody) as SlackEventPayload;
}

/**
 * Type guard: check if an event is a message event.
 */
export function isMessageEvent(
  event: SlackMessageEvent | undefined,
): event is SlackMessageEvent {
  return (
    event !== undefined &&
    (event.type === "message" || event.type === "app_mention")
  );
}

/**
 * Check if the event is from a bot (echo loop prevention).
 * Returns true if the event has a bot_id or subtype is 'bot_message'.
 */
export function isBotMessage(event: SlackMessageEvent): boolean {
  return !!event.bot_id || event.subtype === "bot_message";
}

/**
 * Fetch and decrypt the Slack signing secret from the secrets table.
 * Returns null if no signing secret is stored for this business.
 */
export async function getSigningSecret(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string | null> {
  const { data: secret } = await supabase
    .from("secrets")
    .select("encrypted_value")
    .eq("business_id", businessId)
    .eq("provider", "slack")
    .eq("key", "signing_secret")
    .single();

  if (!secret) return null;

  return decrypt(secret.encrypted_value as string);
}
