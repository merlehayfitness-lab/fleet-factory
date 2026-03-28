import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { AgentsList } from "@/_components/agents-list";

/**
 * Agents list page (Server Component).
 *
 * Fetches all agents for the business with department and template joins,
 * plus skill assignment counts per agent (direct + department-inherited).
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

  // Query skill counts per agent (direct assignments)
  const { data: agentSkillCounts } = await supabase
    .from("skill_assignments")
    .select("agent_id")
    .eq("business_id", businessId)
    .not("agent_id", "is", null);

  // Query skill counts per department (inherited)
  const { data: deptSkillCounts } = await supabase
    .from("skill_assignments")
    .select("department_id")
    .eq("business_id", businessId)
    .not("department_id", "is", null);

  // Build count maps
  const agentCountMap = new Map<string, number>();
  for (const row of agentSkillCounts ?? []) {
    const aid = row.agent_id as string;
    agentCountMap.set(aid, (agentCountMap.get(aid) ?? 0) + 1);
  }

  const deptCountMap = new Map<string, number>();
  for (const row of deptSkillCounts ?? []) {
    const did = row.department_id as string;
    deptCountMap.set(did, (deptCountMap.get(did) ?? 0) + 1);
  }

  // Merge counts into agent data (direct + inherited from department)
  const agentsWithSkills = (agents ?? []).map((agent) => {
    const directCount = agentCountMap.get(agent.id as string) ?? 0;
    const deptId = (agent.departments as { id: string } | null)?.id;
    const inheritedCount = deptId ? (deptCountMap.get(deptId) ?? 0) : 0;
    return {
      ...agent,
      skill_count: directCount + inheritedCount,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage agents across departments
          </p>
        </div>
        <Link
          href={`/businesses/${businessId}/agents/new`}
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          New Agent
        </Link>
      </div>

      {agentsWithSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="text-sm text-muted-foreground">
            No agents found. Create a business to provision starter agents.
          </p>
        </div>
      ) : (
        <AgentsList agents={agentsWithSkills} businessId={businessId} />
      )}
    </div>
  );
}
