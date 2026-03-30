"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSlackInstallation,
  getSlackInstallUrl,
  disconnectSlack,
  getChannelMappings,
  getSlackFeedMessages,
  saveProviderCredentials,
} from "@agency-factory/core/server";
import type { SlackConnectionStatus, SlackChannelMapping, ChatMessage } from "@agency-factory/core";

/**
 * Check if Slack is connected for a business.
 * Returns connection status with team info.
 */
export async function getSlackStatusAction(
  businessId: string,
): Promise<{ status: SlackConnectionStatus } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const installation = await getSlackInstallation(supabase, businessId);

    if (!installation) {
      return { status: { connected: false } };
    }

    return {
      status: {
        connected: true,
        teamName: installation.slackTeamName,
        teamId: installation.slackTeamId,
        botUserId: installation.botUserId,
        installedAt: installation.installedAt,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to check Slack status",
    };
  }
}

/**
 * Get the Slack OAuth install URL for a business.
 * Used by the frontend to open the OAuth popup.
 */
export async function connectSlackAction(
  businessId: string,
): Promise<{ url: string } | { error: string; code?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const url = await getSlackInstallUrl(businessId, supabase as Parameters<typeof getSlackInstallUrl>[1]);
    return { url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate Slack install URL";
    if (msg === "SLACK_APP_NOT_CONFIGURED") {
      return { error: msg, code: "SLACK_APP_NOT_CONFIGURED" };
    }
    return { error: msg };
  }
}

/**
 * Save Slack app credentials (client_id + client_secret) for a business.
 * These are entered once to enable the OAuth flow.
 */
export async function saveSlackAppCredentialsAction(
  businessId: string,
  clientId: string,
  clientSecret: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!clientId.trim() || !clientSecret.trim()) {
    return { error: "Both Client ID and Client Secret are required." };
  }

  try {
    await saveProviderCredentials(supabase, businessId, "slack", {
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
    });
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save Slack credentials",
    };
  }
}

/**
 * Disconnect Slack from a business.
 * Removes installation, channel mappings, and secrets.
 */
export async function disconnectSlackAction(
  businessId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    await disconnectSlack(supabase, businessId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to disconnect Slack",
    };
  }

  revalidatePath(`/businesses/${businessId}/integrations`);
  revalidatePath(`/businesses/${businessId}/chat`);
  return { success: true };
}

/**
 * Get Slack channel mappings for a business, joined with department names.
 * Returns channel mappings with department info for display.
 */
export async function getSlackChannelsAction(
  businessId: string,
): Promise<
  | { channels: (SlackChannelMapping & { departmentName: string; departmentType: string })[] }
  | { error: string }
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const mappings = await getChannelMappings(supabase, businessId);

    // Batch fetch department names
    const deptIds = [...new Set(mappings.map((m) => m.departmentId))];
    const deptMap = new Map<string, { name: string; type: string }>();

    if (deptIds.length > 0) {
      const { data: depts } = await supabase
        .from("departments")
        .select("id, name, type")
        .in("id", deptIds);

      for (const dept of depts ?? []) {
        deptMap.set(dept.id as string, {
          name: dept.name as string,
          type: dept.type as string,
        });
      }
    }

    const channels = mappings.map((m) => {
      const dept = deptMap.get(m.departmentId);
      return {
        ...m,
        departmentName: dept?.name ?? "Unknown",
        departmentType: dept?.type ?? "custom",
      };
    });

    return { channels };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch Slack channels",
    };
  }
}

/**
 * Get Slack-synced messages for a department.
 * Returns only messages that have slack_ts (Slack-synced).
 * Used by chat layout to show Slack-only messages when connected.
 */
export async function getSlackFeedMessagesAction(
  businessId: string,
  departmentId: string,
  limit?: number,
  before?: string,
): Promise<{ messages: ChatMessage[] } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const messages = await getSlackFeedMessages(
      supabase,
      businessId,
      departmentId,
      limit,
      before,
    );
    return { messages };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch Slack feed messages",
    };
  }
}
