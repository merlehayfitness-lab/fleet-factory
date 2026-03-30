import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { EmbeddedTerminal } from "@/_components/embedded-terminal";
import { TerminalInfoBar } from "@/_components/terminal-info-bar";

/**
 * Business terminal page -- Server Component.
 *
 * Validates auth, checks VPS configuration, builds WebSocket URL,
 * and renders the embedded xterm.js terminal with info bar.
 * If VPS is not configured, redirects to business overview.
 */
export default async function BusinessTerminalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Business check
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, slug, status")
    .eq("id", id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // VPS check: redirect if not configured
  const vpsApiUrl = process.env.VPS_API_URL;
  const vpsApiKey = process.env.VPS_API_KEY;
  if (!vpsApiUrl || !vpsApiKey) {
    redirect(`/businesses/${id}`);
  }

  // Build WebSocket URL with auth
  const wsBase = vpsApiUrl.replace(/^http/, "ws").replace(/\/$/, "");
  const wsUrl = `${wsBase}/ws/terminal/${business.slug}?apiKey=${encodeURIComponent(vpsApiKey)}`;

  // Fetch VPS health for info bar (best-effort)
  let vpsStatus = "unknown";
  let agentCount = 0;
  try {
    const healthRes = await fetch(`${vpsApiUrl}/api/health`, {
      headers: { "X-API-Key": vpsApiKey },
      cache: "no-store",
    });
    if (healthRes.ok) {
      const health = await healthRes.json();
      vpsStatus = health.status ?? "unknown";
      agentCount = health.agentCount ?? 0;
    }
  } catch {
    vpsStatus = "offline";
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#1a1a2e]">
      <TerminalInfoBar
        businessId={business.id as string}
        businessName={business.name as string}
        businessSlug={business.slug as string}
        vpsStatus={vpsStatus}
        agentCount={agentCount}
      />
      <div className="flex-1 overflow-hidden p-1">
        <EmbeddedTerminal wsUrl={wsUrl} />
      </div>
    </div>
  );
}
