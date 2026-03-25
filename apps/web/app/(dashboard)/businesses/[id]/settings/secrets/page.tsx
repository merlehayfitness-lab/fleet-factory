import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/_lib/supabase/server";
import { SecretsManager } from "@/_components/secrets-manager";

/**
 * Secrets management page (Server Component).
 *
 * Fetches all secrets for the business and renders
 * the categorized secrets manager UI.
 */
export default async function SecretsPage({
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

  // Verify business exists
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch secrets
  const { data: secrets } = await supabase
    .from("secrets")
    .select("*")
    .eq("business_id", businessId)
    .order("category")
    .order("key");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/businesses/${businessId}/deployments`}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Deployment Center
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Secrets & Credentials
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage encrypted credentials for {business.name}
        </p>
      </div>

      <SecretsManager
        secrets={(secrets ?? []).map((s) => ({
          id: s.id,
          business_id: s.business_id,
          key: s.key,
          encrypted_value: s.encrypted_value,
          category: s.category,
          integration_type: s.integration_type ?? null,
          created_at: s.created_at,
          updated_at: s.updated_at,
        }))}
        businessId={businessId}
      />
    </div>
  );
}
