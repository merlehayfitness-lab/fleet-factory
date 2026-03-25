import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { BusinessList } from "@/_components/business-list";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "Businesses | Agency Factory",
};

/**
 * Businesses list page.
 *
 * Server Component that fetches all businesses the user has access to.
 * RLS automatically scopes results -- no manual business_id filtering needed.
 */
export default async function BusinessesPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("*, business_users!inner(role)")
    .order("created_at", { ascending: false });

  if (error) {
    // RLS ensures we only get our businesses; an error here is unexpected
    throw new Error(`Failed to load businesses: ${error.message}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Businesses</h1>
          <p className="text-sm text-muted-foreground">
            Manage your business workspaces and agent deployments.
          </p>
        </div>
        <Link href="/businesses/new" className={buttonVariants()}>
          <Plus className="mr-2 size-4" />
          New Business
        </Link>
      </div>

      {!businesses || businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">No businesses yet</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Create your first business to get started with agent deployment.
          </p>
          <Link href="/businesses/new" className={buttonVariants()}>
            <Plus className="mr-2 size-4" />
            Create your first business
          </Link>
        </div>
      ) : (
        <BusinessList businesses={businesses} />
      )}
    </div>
  );
}
