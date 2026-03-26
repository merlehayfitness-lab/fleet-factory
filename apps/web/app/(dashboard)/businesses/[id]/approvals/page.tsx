import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { ApprovalsList } from "@/_components/approvals-list";
import { Badge } from "@/components/ui/badge";

/**
 * Approvals page (Server Component).
 *
 * Fetches approvals with task and agent joins for a business.
 * Renders the ApprovalsList client component with bulk actions.
 */
export default async function ApprovalsPage({
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
    .select("id, name")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch approvals with task and agent joins
  const { data: approvals } = await supabase
    .from("approvals")
    .select("*, tasks:task_id(title), agents:agent_id(name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const approvalsList = (approvals ?? []) as ApprovalRow[];
  const pendingCount = approvalsList.filter(
    (a) => a.status === "pending",
  ).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        {pendingCount > 0 && (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          >
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {/* Approvals list with bulk actions */}
      <ApprovalsList approvals={approvalsList} businessId={businessId} />
    </div>
  );
}

/** Type alias for Supabase return shape */
type ApprovalRow = {
  id: string;
  business_id: string;
  task_id: string;
  agent_id: string;
  action_type: string;
  action_summary: string;
  agent_reasoning: string | null;
  risk_level: string;
  risk_explanation: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  retry_count: number;
  created_at: string;
  tasks: { title: string } | null;
  agents: { name: string } | null;
};
