import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { getDepartmentChannels, getVpsStatus } from "@fleet-factory/core/server";
import { ChatLayout } from "@/_components/chat-layout";
import { getSlackStatusAction, getSlackChannelsAction } from "@/_actions/slack-actions";
import type { SlackConnectionStatus } from "@fleet-factory/core";

/**
 * Chat page Server Component.
 *
 * Fetches business details, Slack connection status, and department channels,
 * then passes data to the ChatLayout client component.
 * When Slack is connected, passes Slack channel mappings for the sidebar.
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch business details including slug for deep links
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, slug")
    .eq("id", id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Fetch department channels, VPS status, and Slack status in parallel
  const [channels, vpsStatusResult, slackStatusResult, slackChannelsResult] =
    await Promise.all([
      getDepartmentChannels(supabase, id, user.id),
      getVpsStatus(supabase).catch(() => null),
      getSlackStatusAction(id),
      getSlackChannelsAction(id),
    ]);

  const vpsStatus = vpsStatusResult
    ? { status: vpsStatusResult.status as string, lastCheckedAt: vpsStatusResult.last_checked_at as string }
    : null;

  const slackStatus: SlackConnectionStatus =
    "status" in slackStatusResult
      ? slackStatusResult.status
      : { connected: false };

  const slackChannels =
    "channels" in slackChannelsResult ? slackChannelsResult.channels : [];

  const slackTeamId =
    slackStatus.connected ? slackStatus.teamId : null;

  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading chat...</div>}>
      <ChatLayout
        businessId={business.id as string}
        businessName={business.name as string}
        businessSlug={business.slug as string}
        channels={channels}
        vpsStatus={vpsStatus}
        slackStatus={slackStatus}
        slackChannels={slackChannels}
        slackTeamId={slackTeamId}
      />
    </Suspense>
  );
}
