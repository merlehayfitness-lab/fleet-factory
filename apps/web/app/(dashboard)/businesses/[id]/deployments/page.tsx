import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { DeploymentCenter } from "@/_components/deployment-center";
import { DeployButton } from "@/_components/deploy-button";
import { RollbackDialog } from "@/_components/rollback-dialog";
import { isVpsConfigured, createVpsWebSocket } from "@fleet-factory/core/server";

/**
 * Deployment center page (Server Component).
 *
 * Fetches business, deployments, and agent count, then renders
 * split-view deployment center with deploy/rollback controls.
 */
export default async function DeploymentsPage({
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

  // Fetch business
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch deployments
  const { data: deployments } = await supabase
    .from("deployments")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch agent count
  const { count: agentCount } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  const deploymentsList = deployments ?? [];
  const hasLiveDeployment = deploymentsList.some((d) => d.status === "live");

  // Generate VPS context for active deployments
  const activeDeployment = deploymentsList.find((d) =>
    ["deploying", "verifying"].includes(d.status),
  );
  let vpsWsUrl: string | null = null;
  let vpsConfigured = false;
  if (isVpsConfigured()) {
    vpsConfigured = true;
    if (activeDeployment) {
      vpsWsUrl = createVpsWebSocket(`/deploy/${activeDeployment.id}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Deployment Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage deployments for {business.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RollbackDialog
            businessId={businessId}
            deployments={deploymentsList.map((d) => ({
              id: d.id,
              version: d.version,
              status: d.status,
              created_at: d.created_at,
              config_snapshot: d.config_snapshot as Record<string, unknown> | null,
            }))}
          />
          <DeployButton
            businessId={businessId}
            hasLiveDeployment={hasLiveDeployment}
            agentCount={agentCount ?? 0}
          />
        </div>
      </div>

      {/* Deployment center with split view */}
      {deploymentsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <p className="mb-2 text-sm text-muted-foreground">
            No deployments yet
          </p>
          <p className="text-xs text-muted-foreground/70">
            Click Deploy to create your first deployment
          </p>
        </div>
      ) : (
        <DeploymentCenter
          deployments={deploymentsList.map((d) => ({
            id: d.id,
            business_id: d.business_id,
            version: d.version,
            status: d.status,
            error_message: d.error_message ?? null,
            created_at: d.created_at,
            started_at: d.started_at ?? null,
            completed_at: d.completed_at ?? null,
            config_snapshot: d.config_snapshot as Record<string, unknown> | null,
          }))}
          businessId={businessId}
          vpsWsUrl={vpsWsUrl}
          vpsConfigured={vpsConfigured}
          activeDeploymentId={activeDeployment?.id ?? null}
        />
      )}
    </div>
  );
}
