import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TemplateForm } from "@/_components/template-form";

/**
 * Create new agent template page.
 */
export default async function NewTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
          Create Agent Template
        </h1>
        <p className="text-sm text-muted-foreground">
          Define a reusable blueprint for AI agents. Templates are shared across
          all businesses.
        </p>
      </div>

      <TemplateForm businessId={id} />
    </div>
  );
}
