import Link from "next/link";
import { createServerClient } from "@/_lib/supabase/server";
import { TemplateList } from "@/_components/template-list";
import { Plus } from "lucide-react";

/**
 * Agent Templates list page.
 *
 * Templates are global (not business-scoped), but routed under the business
 * path for navigation consistency. Fetches all templates ordered by
 * department_type then name.
 */
export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: templates, error } = await supabase
    .from("agent_templates")
    .select("*")
    .order("department_type")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agent Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage blueprints for AI agents. Templates define the system prompt,
            tools, and model configuration for each department type.
          </p>
        </div>
        <Link
          href={`/businesses/${id}/templates/new`}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <Plus className="size-4" />
          New Template
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load templates: {error.message}
        </div>
      ) : (
        <TemplateList templates={templates ?? []} businessId={id} />
      )}
    </div>
  );
}
