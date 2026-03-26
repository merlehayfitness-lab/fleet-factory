import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { TasksPageClient } from "./tasks-page-client";

/**
 * Tasks page (Server Component).
 *
 * Fetches tasks, departments, and agents for a business.
 * Renders the client wrapper with table/kanban toggle, quick-add, and filters.
 */
export default async function TasksPage({
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

  // Fetch tasks with department and agent joins
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "*, departments:department_id(name), agents:assigned_agent_id(name)",
    )
    .eq("business_id", businessId)
    .is("parent_task_id", null)
    .order("created_at", { ascending: false });

  // Fetch departments for filter and quick-add
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("business_id", businessId)
    .order("name");

  // Fetch agents for filter
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .eq("business_id", businessId)
    .order("name");

  // Count pending approvals for notification badge
  const { count: pendingApprovals } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "pending");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Work queue across all departments
          </p>
        </div>
        {(pendingApprovals ?? 0) > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            {pendingApprovals} pending approval{pendingApprovals !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Client wrapper with toggle, quick-add, filters, and views */}
      <TasksPageClient
        tasks={(tasks ?? []) as TaskRow[]}
        departments={(departments ?? []) as DepartmentRow[]}
        agents={(agents ?? []) as AgentRow[]}
        businessId={businessId}
      />
    </div>
  );
}

/** Type aliases for Supabase return shapes */
type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  departments: { name: string } | null;
  agents: { name: string } | null;
};

type DepartmentRow = {
  id: string;
  name: string;
};

type AgentRow = {
  id: string;
  name: string;
};
