import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { StatusBadge } from "@/_components/status-badge";
import { AgentDetailTabs } from "@/_components/agent-detail-tabs";

/**
 * Agent detail page (Server Component).
 *
 * Fetches the agent with department, template, audit log, knowledge docs,
 * integration, parent agent, and child agent data. Renders a header with
 * status badge, parent link (for sub-agents), and back link, then delegates
 * to the client-side AgentDetailTabs component.
 */
export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string; agentId: string }>;
}) {
  const { id: businessId, agentId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch agent with department and full template data
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select(
      "*, departments(id, name, type), agent_templates(id, name, system_prompt, tool_profile, model_profile)",
    )
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();

  if (agentError || !agent) {
    notFound();
  }

  // Fetch recent audit log entries for this agent
  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("business_id", businessId)
    .eq("entity_type", "agent")
    .eq("entity_id", agentId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch integrations for this agent
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("agent_id", agentId)
    .eq("business_id", businessId)
    .order("type");

  // Fetch knowledge documents (agent-specific + global) for context suggestion UI
  const { data: knowledgeDocs } = await supabase
    .from("knowledge_documents")
    .select("id, title")
    .eq("business_id", businessId)
    .or(`agent_id.eq.${agentId},agent_id.is.null`)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  // Fetch parent agent (if this is a sub-agent)
  let parentAgent: { id: string; name: string; status: string; role: string | null } | null = null;
  if (agent.parent_agent_id) {
    const { data: parent } = await supabase
      .from("agents")
      .select("id, name, status, role")
      .eq("id", agent.parent_agent_id as string)
      .eq("business_id", businessId)
      .single();

    if (parent) {
      parentAgent = {
        id: parent.id as string,
        name: parent.name as string,
        status: parent.status as string,
        role: (parent.role as string) ?? null,
      };
    }
  }

  // Fetch child agents (sub-agents of this agent)
  const { data: childAgentsData } = await supabase
    .from("agents")
    .select("id, name, status, role")
    .eq("parent_agent_id", agentId)
    .eq("business_id", businessId)
    .order("created_at");

  const childAgents = (childAgentsData ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    status: a.status as string,
    role: (a.role as string) ?? null,
  }));

  // Fetch departments for the catalog dialog
  const { data: departmentsData } = await supabase
    .from("departments")
    .select("id, name, type")
    .eq("business_id", businessId)
    .order("name");

  const departments = (departmentsData ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    type: d.type as string,
  }));

  // Fetch all agents in business (for catalog target picker)
  const { data: allAgentsData } = await supabase
    .from("agents")
    .select("id, name, department_id")
    .eq("business_id", businessId);

  const allAgents = (allAgentsData ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    department_id: a.department_id as string,
  }));

  // Build config-friendly integration list
  const configIntegrations = (integrations ?? []).map((i) => ({
    id: i.id as string,
    name: (i.provider as string) ?? (i.type as string),
    type: i.type as string,
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/businesses/${businessId}/agents`}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Agents
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
          <StatusBadge status={agent.status} />
        </div>
        {parentAgent && (
          <p className="mt-1 text-sm text-muted-foreground">
            Sub-agent of{" "}
            <Link
              href={`/businesses/${businessId}/agents/${parentAgent.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {parentAgent.name}
            </Link>
          </p>
        )}
      </div>

      <AgentDetailTabs
        agent={agent}
        auditLogs={auditLogs ?? []}
        businessId={businessId}
        integrations={integrations ?? []}
        knowledgeDocs={
          (knowledgeDocs ?? []).map((d) => ({
            id: d.id as string,
            title: d.title as string,
          }))
        }
        configIntegrations={configIntegrations}
        parentAgent={parentAgent ?? undefined}
        childAgents={childAgents.length > 0 ? childAgents : undefined}
        departments={departments}
        allAgents={allAgents}
      />
    </div>
  );
}
