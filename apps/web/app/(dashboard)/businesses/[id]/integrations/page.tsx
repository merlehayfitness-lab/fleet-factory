import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { IntegrationsOverview } from "@/_components/integrations-overview";
import { IntegrationCatalogDialog } from "@/_components/integration-catalog-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

/**
 * Business-wide integrations overview page (Server Component).
 *
 * Shows all configured integrations across all agents and departments,
 * grouped by integration type. Includes "Add Integration" button that
 * opens the catalog dialog.
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

  // Fetch all integrations for this business with agent and department names
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*, agents(id, name), departments(id, name)")
    .eq("business_id", businessId)
    .order("type")
    .order("created_at");

  // Fetch all agents for this business (with department_id for target picker)
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, status, department_id")
    .eq("business_id", businessId);

  // Fetch departments for the catalog dialog target picker
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, type")
    .eq("business_id", businessId)
    .order("name");

  const agentsList = (agents ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    status: a.status as string,
    department_id: a.department_id as string,
  }));

  const departmentsList = (departments ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    type: d.type as string,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Manage integration connections across all agents and departments
          </p>
        </div>
        <IntegrationCatalogDialog
          businessId={businessId}
          departments={departmentsList}
          agents={agentsList}
          trigger={
            <Button size="sm">
              <Plus className="mr-1.5 size-3.5" />
              Add Integration
            </Button>
          }
        />
      </div>

      <IntegrationsOverview
        integrations={integrations ?? []}
        agents={agentsList}
        businessId={businessId}
      />
    </div>
  );
}
