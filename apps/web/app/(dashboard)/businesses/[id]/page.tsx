import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { HealthDashboard } from "@/_components/health-dashboard";
import { HealthDashboardErrorBoundary } from "@/_components/health-dashboard-wrapper";

/**
 * Business overview — rebuilt with safe data passing.
 */
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, slug, industry, status, created_at, plan_tier, monthly_token_limit")
    .eq("id", id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Build a safe business object with only the fields HealthDashboard needs
  const safeBusiness = {
    id: (business.id ?? "") as string,
    name: (business.name ?? "") as string,
    slug: (business.slug ?? "") as string,
    industry: (business.industry ?? "general") as string,
    status: (business.status ?? "provisioning") as string,
    created_at: (business.created_at ?? new Date().toISOString()) as string,
  };

  // Empty but correctly shaped health data
  const emptyHealth = {
    agentHealth: { departments: [] as Array<{ department: { id: string; name: string; type: string }; agents: Array<{ id: string; name: string; status: string; lastTaskAt: string | null; errorCount: number }> }> },
    errorRate: { failedCount: 0, totalCount: 0, rate: 0, assistanceRequestCount: 0 },
    taskThroughput: { completedCount: 0, queuedCount: 0, avgCompletionMinutes: null as number | null },
    recentActivity: [] as Array<{ id: string; action: string; entityType: string | null; entityId: string | null; metadata: Record<string, unknown>; createdAt: string; actorId: string | null }>,
    latestDeployment: null as { id: string; status: string; version: number; created_at: string } | null,
    pendingApprovals: 0,
    activeTasks: 0,
    vpsStatus: null as { status: string; lastCheckedAt: string; details?: Record<string, unknown> } | null,
  };

  const emptyUsage = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCostCents: 0,
    byAgent: [] as Array<{ agentId: string; agentName: string; promptTokens: number; completionTokens: number; costCents: number }>,
  };

  return (
    <div className="space-y-0">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
          {((business.plan_tier as string) ?? "PRO").toUpperCase()} Plan
        </span>
      </div>

      <HealthDashboardErrorBoundary>
        <HealthDashboard
          business={safeBusiness}
          initialHealth={emptyHealth}
          usageSummary={emptyUsage}
          vpsStatus={null}
          vpsWarning={null}
          bannerAgents={[]}
          bannerDepartments={[]}
        />
      </HealthDashboardErrorBoundary>
    </div>
  );
}
