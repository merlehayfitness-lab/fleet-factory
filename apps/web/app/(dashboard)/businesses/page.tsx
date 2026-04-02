import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { BusinessList } from "@/_components/business-list";

export const metadata = {
  title: "Businesses | Fleet Factory",
};

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
    throw new Error(`Failed to load businesses: ${error.message}`);
  }

  const btnClasses =
    "inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium h-8 gap-1.5 px-2.5 transition-all hover:bg-primary/80";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Businesses</h1>
          <p className="text-sm text-muted-foreground">
            Manage your business workspaces and agent deployments.
          </p>
        </div>
        <Link href="/businesses/new" className={btnClasses}>
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
          <Link href="/businesses/new" className={btnClasses}>
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
