import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { StatusBadge } from "@/_components/status-badge";
import { AgentDetailTabs } from "@/_components/agent-detail-tabs";

/**
 * Agent detail page (Server Component).
 *
 * Fetches the agent with department, template, and audit log data.
 * Renders a header with status badge and back link, then delegates
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

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
        <StatusBadge status={agent.status} />
      </div>

      <AgentDetailTabs
        agent={agent}
        auditLogs={auditLogs ?? []}
        businessId={businessId}
        integrations={integrations ?? []}
      />
    </div>
  );
}
