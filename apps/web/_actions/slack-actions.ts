"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getSlackInstallation,
  getSlackInstallUrl,
  disconnectSlack,
  getChannelMappings,
} from "@agency-factory/core/server";
import type { SlackConnectionStatus, SlackChannelMapping } from "@agency-factory/core";

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
): Promise<{ url: string } | { error: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const url = getSlackInstallUrl(businessId);
    return { url };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to generate Slack install URL",
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
