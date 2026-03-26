import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { getDepartmentChannels } from "@agency-factory/core/server";
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

  // Fetch department channels
  const channels = await getDepartmentChannels(supabase, id, user.id);

  return (
    <ChatLayout
      businessId={business.id as string}
      businessName={business.name as string}
      channels={channels}
    />
  );
}
