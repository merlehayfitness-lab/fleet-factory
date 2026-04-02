import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "@/_lib/env";
import {
  verifySlackSignature,
  parseSlackEvent,
  isMessageEvent,
  isBotMessage,
  getSigningSecret,
  handleInboundSlackMessage,
} from "@fleet-factory/core/server";

/**
 * POST handler for Slack Events API webhooks.
 *
 * SECURITY NOTE (SECR-05 exception): Uses service_role client because
 * Slack webhooks have no user auth session. Signing secret verification
 * provides the authentication layer.
 *
 * Must respond within 3 seconds. Message processing is fire-and-forget.
 */
export async function POST(request: Request) {
  // 1. Read raw body first (required for signature verification)
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  // 2. Parse the payload to get team_id for signing secret lookup
  let payload;
  try {
    payload = parseSlackEvent(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  // 3. Handle url_verification challenge (no signing secret verification needed for setup)
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  // 4. Look up the business from team_id to get signing secret
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return new Response("Server configuration error", { status: 500 });
  }

  const supabase = createClient(getSupabaseUrl(), serviceRoleKey);

  // Find business from team_id
  const { data: installation } = await supabase
    .from("slack_installations")
    .select("business_id")
    .eq("slack_team_id", payload.team_id)
    .single();

  if (!installation) {
    return new Response("Unknown team", { status: 404 });
  }

  const businessId = installation.business_id as string;

  // 5. Verify signing secret
  const signingSecret = await getSigningSecret(supabase, businessId);
  if (!signingSecret) {
    return new Response("Signing secret not configured", { status: 500 });
  }

  if (!verifySlackSignature(signingSecret, rawBody, timestamp, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // 6. Handle event_callback
  if (payload.type === "event_callback" && payload.event) {
    const event = payload.event;

    // Skip bot messages to prevent echo loop
    if (isBotMessage(event)) {
      return new Response("ok", { status: 200 });
    }

    // Process message events asynchronously (fire-and-forget)
    if (isMessageEvent(event) && event.text) {
      void handleInboundSlackMessage(supabase, payload.team_id, event);
    }

    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}
