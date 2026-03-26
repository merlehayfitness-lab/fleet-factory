import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { NewTaskForm } from "./new-task-form";

/**
 * Full task creation page (Server Component).
 *
 * Fetches business, departments, and agents for the creation form.
 */
export default async function NewTaskPage({
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

  // Fetch departments
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("business_id", businessId)
    .order("name");

  // Fetch active agents
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Task</h1>
        <p className="text-sm text-muted-foreground">
          Create a new task for {business.name}
        </p>
      </div>

      <NewTaskForm
        businessId={businessId}
        departments={(departments ?? []) as Array<{ id: string; name: string }>}
        agents={(agents ?? []) as Array<{ id: string; name: string }>}
      />
    </div>
  );
}
