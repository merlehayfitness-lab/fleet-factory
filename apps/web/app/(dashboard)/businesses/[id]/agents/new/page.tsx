import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { getDepartmentsWithAgentCountAction } from "@/_actions/agent-wizard-actions";
import { AgentSetupWizard } from "@/_components/agent-setup-wizard";

/**
 * New Agent wizard page (Server Component).
 *
 * Fetches business details, departments with agent counts, and
 * integrations, then renders the multi-step AgentSetupWizard.
 */
export default async function NewAgentPage({
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

  // Fetch business details
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id, name, industry")
    .eq("id", businessId)
    .single();

  if (bizError || !business) {
    notFound();
  }

  // Fetch departments with agent counts
  const deptResult = await getDepartmentsWithAgentCountAction(businessId);
  const departments =
    "departments" in deptResult ? deptResult.departments : [];

  // Fetch integrations for the business
  const { data: integrations } = await supabase
    .from("integrations")
    .select("id, name, type, status")
    .eq("business_id", businessId)
    .eq("status", "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/businesses/${businessId}/agents`}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Agent</h1>
          <p className="text-sm text-muted-foreground">
            Set up a new agent for {business.name}
          </p>
        </div>
      </div>

      <AgentSetupWizard
        businessId={businessId}
        businessName={business.name as string}
        businessIndustry={(business.industry as string) ?? "general"}
        departments={departments}
        integrations={
          (integrations ?? []).map((i) => ({
            id: i.id as string,
            name: i.name as string,
            type: i.type as string,
          }))
        }
      />
    </div>
  );
}
