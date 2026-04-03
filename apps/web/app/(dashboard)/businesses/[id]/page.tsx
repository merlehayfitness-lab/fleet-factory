import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { HealthDashboard } from "@/_components/health-dashboard";
import { HealthDashboardErrorBoundary } from "@/_components/health-dashboard-wrapper";
import { getSystemHealth } from "@fleet-factory/core/server";
import type { SystemHealth } from "@fleet-factory/core/server";

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

  // Fetch health data — fall back to empty on error
  let health: SystemHealth;
  try {
    health = await getSystemHealth(supabase, id);
  } catch {
    health = {
      agentHealth: { departments: [] },
      errorRate: { failedCount: 0, totalCount: 0, rate: 0, assistanceRequestCount: 0 },
      taskThroughput: { completedCount: 0, queuedCount: 0, avgCompletionMinutes: null },
      recentActivity: [],
      latestDeployment: null,
      pendingApprovals: 0,
      activeTasks: 0,
      vpsStatus: null,
    } as SystemHealth;
  }

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
          initialHealth={health}
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
