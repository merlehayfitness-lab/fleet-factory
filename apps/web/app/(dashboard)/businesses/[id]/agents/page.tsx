import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { AgentTreeView } from "@/_components/agent-tree-view";

/**
 * Agents page (Server Component).
 *
 * Fetches all agents for the business with department joins,
 * plus skill assignment counts per agent (direct + department-inherited).
 * Renders the AgentTreeView hierarchy instead of a flat list.
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

  // Fetch departments separately for the tree view headers
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, type")
    .eq("business_id", businessId)
    .order("created_at");

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
            Agent hierarchy across departments
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Agent hierarchy across departments
        </p>
      </div>

      <AgentTreeView
        agents={agentsWithSkills.map((a) => ({
          id: a.id as string,
          name: a.name as string,
          status: a.status as string,
          role: (a.role as string) ?? null,
          parent_agent_id: (a.parent_agent_id as string) ?? null,
          model_profile: (a.model_profile as Record<string, unknown>) ?? {},
          departments: a.departments
            ? {
                id: (a.departments as { id: string; name: string; type: string }).id,
                name: (a.departments as { id: string; name: string; type: string }).name,
                type: (a.departments as { id: string; name: string; type: string }).type,
              }
            : null,
          skill_count: a.skill_count,
        }))}
        departments={(departments ?? []).map((d) => ({
          id: d.id as string,
          name: d.name as string,
          type: d.type as string,
        }))}
        businessId={businessId}
      />
    </div>
  );
}
