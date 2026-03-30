// Slack OAuth installation flow helpers.
// Handles generating install URLs, exchanging codes for tokens, and managing installations.

import type { SupabaseClient } from "@supabase/supabase-js";
import { WebClient } from "@slack/web-api";
import type { SlackInstallation } from "./slack-types";
import { saveProviderCredentials, deleteProviderSecrets } from "../secrets/service";

// Required bot scopes for the Slack app
const SLACK_BOT_SCOPES = [
  "channels:manage",
  "channels:read",
  "channels:history",
  "chat:write",
  "users:read",
  "app_mentions:read",
].join(",");

/**
 * Get the SLACK_CLIENT_ID env var. Throws if missing.
 */
export function getSlackClientId(): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Missing SLACK_CLIENT_ID environment variable. " +
        "Set it in .env.local with your Slack app's Client ID.",
    );
  }
  return clientId;
}

/**
 * Get the SLACK_CLIENT_SECRET env var. Throws if missing.
 */
export function getSlackClientSecret(): string {
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error(
      "Missing SLACK_CLIENT_SECRET environment variable. " +
        "Set it in .env.local with your Slack app's Client Secret.",
    );
  }
  return clientSecret;
}

/**
 * Generate the Slack OAuth authorize URL for installing the app.
 * Uses state=businessId for mapping the callback to the correct business.
 */
export function getSlackInstallUrl(businessId: string): string {
  const clientId = getSlackClientId();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/slack/oauth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SLACK_BOT_SCOPES,
    redirect_uri: redirectUri,
    state: businessId,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Handle the OAuth callback: exchange code for token, store credentials, create installation record.
 */
export async function handleSlackOAuthCallback(
  supabase: SupabaseClient,
  code: string,
  businessId: string,
): Promise<SlackInstallation> {
  const clientId = getSlackClientId();
  const clientSecret = getSlackClientSecret();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/slack/oauth/callback`;

  // Exchange code for bot token via oauth.v2.access
  const tempClient = new WebClient();
  const oauthResult = await tempClient.oauth.v2.access({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const botToken = oauthResult.access_token;
  const teamId = oauthResult.team?.id;
  const teamName = oauthResult.team?.name;
  const botUserId = oauthResult.bot_user_id;

  if (!botToken || !teamId || !botUserId) {
    throw new Error("Slack OAuth response missing required fields (access_token, team.id, bot_user_id)");
  }

  // Store bot_token via the existing secrets infrastructure
  await saveProviderCredentials(supabase, businessId, "slack", {
    bot_token: botToken,
  });

  // Create slack_installations record
  const { data: installation, error } = await supabase
    .from("slack_installations")
    .upsert(
      {
        business_id: businessId,
        slack_team_id: teamId,
        slack_team_name: teamName ?? null,
        bot_user_id: botUserId,
        installed_at: new Date().toISOString(),
      },
      { onConflict: "business_id" },
    )
    .select("*")
    .single();

  if (error || !installation) {
    throw new Error(
      `Failed to create Slack installation: ${error?.message ?? "No data returned"}`,
    );
  }

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "slack.installed",
      entity_type: "integration",
      metadata: { teamId, teamName },
    });
  } catch {
    console.error("Failed to create Slack install audit log");
  }

  return {
    id: installation.id as string,
    businessId: installation.business_id as string,
    slackTeamId: installation.slack_team_id as string,
    slackTeamName: (installation.slack_team_name as string) ?? null,
    botUserId: installation.bot_user_id as string,
    installedAt: installation.installed_at as string,
  };
}

/**
 * Check if a business has a Slack installation.
 * Returns the installation record or null.
 */
export async function getSlackInstallation(
  supabase: SupabaseClient,
  businessId: string,
): Promise<SlackInstallation | null> {
  const { data, error } = await supabase
    .from("slack_installations")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    businessId: data.business_id as string,
    slackTeamId: data.slack_team_id as string,
    slackTeamName: (data.slack_team_name as string) ?? null,
    botUserId: data.bot_user_id as string,
    installedAt: data.installed_at as string,
  };
}

/**
 * Disconnect Slack from a business.
 * Deletes the installation record, channel mappings, and Slack secrets.
 */
export async function disconnectSlack(
  supabase: SupabaseClient,
  businessId: string,
): Promise<void> {
  // Delete channel mappings
  await supabase
    .from("slack_channel_mappings")
    .delete()
    .eq("business_id", businessId);

  // Delete installation record
  await supabase
    .from("slack_installations")
    .delete()
    .eq("business_id", businessId);

  // Delete Slack secrets via existing infrastructure
  await deleteProviderSecrets(supabase, businessId, "slack");

  // Audit log (best-effort)
  try {
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "slack.disconnected",
      entity_type: "integration",
      metadata: {},
    });
  } catch {
    console.error("Failed to create Slack disconnect audit log");
  }
}
