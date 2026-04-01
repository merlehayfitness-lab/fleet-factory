import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Task queue page for the business owner.
 *
 * Reads tasks from the shared `tasks` table, scoped to the owner's business.
 * Shows pending and in-progress tasks in a sortable table.
 */
export default async function TasksPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Resolve business
  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!membership) {
    return (
      <NoBusinessState />
    );
  }

  const businessId = membership.business_id as string;

  // Fetch tasks for this business
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, source, created_at, departments:department_id(name), agents:assigned_agent_id(name)",
    )
    .eq("business_id", businessId)
    .is("parent_task_id", null)
    .order("created_at", { ascending: false });

  const pendingCount = (tasks ?? []).filter((t) =>
    ["pending", "in_progress"].includes(t.status as string),
  ).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Work queue across your business
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            {pendingCount} open
          </span>
        )}
      </div>

      {/* Tasks table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Task
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Department
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Assigned to
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Priority
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {!tasks || tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CheckSquare className="size-8 opacity-40" />
                    <p className="text-sm font-medium">No tasks yet</p>
                    <p className="text-xs">
                      Tasks created by your agents will appear here.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map((task) => <TaskRow key={task.id as string} task={task} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function NoBusinessState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium">No business found</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Your account is not associated with a business workspace yet.
      </p>
    </div>
  );
}

type TaskRow = {
  id: unknown;
  title: unknown;
  status: unknown;
  priority: unknown;
  source: unknown;
  created_at: unknown;
  departments: unknown;
  agents: unknown;
};

function TaskRow({ task }: { task: TaskRow }) {
  const status = task.status as string;
  const priority = task.priority as string;
  const dept = task.departments as { name: string } | null;
  const agent = task.agents as { name: string } | null;

  const statusColors: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-muted text-muted-foreground",
  };

  const priorityColors: Record<string, string> = {
    critical: "text-red-600 font-semibold",
    high: "text-orange-600",
    medium: "text-foreground",
    low: "text-muted-foreground",
  };

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <p className="font-medium">{task.title as string}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {dept?.name ?? "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {agent?.name ?? "Unassigned"}
      </td>
      <td className="px-4 py-3">
        <span className={cn("text-sm capitalize", priorityColors[priority] ?? "text-foreground")}>
          {priority}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
            statusColors[status] ?? "bg-muted text-muted-foreground",
          )}
        >
          {status.replace("_", " ")}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(task.created_at as string).toLocaleDateString()}
      </td>
    </tr>
  );
}
