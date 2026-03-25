import Link from "next/link";
import { CreateBusinessWizard } from "@/_components/create-business-wizard";

export const metadata = {
  title: "Create a New Business | Agency Factory",
};

/**
 * Create business wizard page.
 * Renders the multi-step form for provisioning a new business tenant.
 */
export default function NewBusinessPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/businesses"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to businesses
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Create a new business
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a new business workspace with departments, agents, and a
          deployment pipeline.
        </p>
      </div>

      <CreateBusinessWizard />
    </div>
  );
}
