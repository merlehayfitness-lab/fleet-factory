import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { IntegrationsOverview } from "@/_components/integrations-overview";

/**
 * Business-wide integrations overview page (Server Component).
 *
 * Shows all configured integrations across all agents for this business,
 * grouped by integration type.
 */
export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: businessId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Verify business exists
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch all integrations for this business with agent names
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*, agents(id, name)")
    .eq("business_id", businessId)
    .order("type")
    .order("created_at");

  // Fetch all agents for this business (for showing unconfigured agents)
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, status")
    .eq("business_id", businessId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Manage integration connections across all agents
        </p>
      </div>

      <IntegrationsOverview
        integrations={integrations ?? []}
        agents={agents ?? []}
        businessId={businessId}
      />
    </div>
  );
}
