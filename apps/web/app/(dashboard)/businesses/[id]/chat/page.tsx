import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { getDepartmentChannels, getVpsStatus } from "@agency-factory/core/server";
import { ChatLayout } from "@/_components/chat-layout";

/**
 * Chat page Server Component.
 *
 * Fetches business details and department channels, then passes data
 * to the ChatLayout client component for the full Slack-like chat experience.
 */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch business details
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
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

  // Fetch department channels and VPS status in parallel
  const [channels, vpsStatusResult] = await Promise.all([
    getDepartmentChannels(supabase, id, user.id),
    getVpsStatus(supabase).catch(() => null),
  ]);

  const vpsStatus = vpsStatusResult
    ? { status: vpsStatusResult.status as string, lastCheckedAt: vpsStatusResult.last_checked_at as string }
    : null;

  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading chat...</div>}>
      <ChatLayout
        businessId={business.id as string}
        businessName={business.name as string}
        channels={channels}
        vpsStatus={vpsStatus}
      />
    </Suspense>
  );
}
