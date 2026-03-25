import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { AgentsList } from "@/_components/agents-list";

/**
 * Agents list page (Server Component).
 *
 * Fetches all agents for the business with department and template joins.
 * RLS scopes results to the authenticated user's businesses.
 */
export default async function AgentsPage({
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

  const { data: agents, error } = await supabase
    .from("agents")
    .select("*, departments(id, name, type), agent_templates(id, name)")
    .eq("business_id", businessId)
    .order("created_at");

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage agents across departments
          </p>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load agents: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Manage agents across departments
        </p>
      </div>

      {!agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">
            No agents found. Create a business to provision starter agents.
          </p>
        </div>
      ) : (
        <AgentsList agents={agents} businessId={businessId} />
      )}
    </div>
  );
}
