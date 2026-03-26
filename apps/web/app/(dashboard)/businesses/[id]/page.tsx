import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { BusinessOverview } from "@/_components/business-overview";

/**
 * Business overview dashboard page.
 *
 * Server Component that fetches business details, agent count,
 * department count, and latest deployment status.
 * All queries use RLS-scoped Supabase client.
 */
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch business details
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch agent count
  const { count: agentCount } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("business_id", id);

  // Fetch department count
  const { count: departmentCount } = await supabase
    .from("departments")
    .select("id", { count: "exact", head: true })
    .eq("business_id", id);

  // Fetch latest deployment
  const { data: latestDeployment } = await supabase
    .from("deployments")
    .select("*")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch pending approval count
  const { count: pendingApprovalCount } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("business_id", id)
    .eq("status", "pending");

  return (
    <BusinessOverview
      business={business}
      agentCount={agentCount ?? 0}
      departmentCount={departmentCount ?? 0}
      latestDeployment={latestDeployment}
      pendingApprovalCount={pendingApprovalCount ?? 0}
    />
  );
}
