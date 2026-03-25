import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { TemplateForm } from "@/_components/template-form";

/**
 * Edit agent template page.
 * Fetches the template by ID and renders the form in edit mode.
 */
export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const { id, templateId } = await params;
  const supabase = await createServerClient();

  const { data: template, error } = await supabase
    .from("agent_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error || !template) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/businesses/${id}/templates`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Templates
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit Template: {template.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Update this template&apos;s configuration. Changes do not affect
          existing agents created from this template.
        </p>
      </div>

      <TemplateForm businessId={id} template={template} />
    </div>
  );
}
