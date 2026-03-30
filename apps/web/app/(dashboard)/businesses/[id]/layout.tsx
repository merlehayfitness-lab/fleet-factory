import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { BusinessStatusProvider } from "@/_components/business-status-provider";
import { SuspendedBanner } from "@/_components/suspended-banner";

/**
 * Business-specific layout.
 *
 * Validates that the current user has access to this business via RLS.
 * If the business doesn't exist or the user lacks access, returns 404.
 * Disabled/suspended businesses still render (frozen dashboard) instead of 404.
 * Wraps children in BusinessStatusProvider for context and renders SuspendedBanner when disabled.
 */
export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (error || !business) {
    notFound();
  }

  const isDisabled =
    business.status === "disabled" || business.status === "suspended";

  return (
    <BusinessStatusProvider
      status={business.status as string}
      businessId={business.id as string}
      businessName={business.name as string}
    >
      {isDisabled && (
        <SuspendedBanner
          businessId={business.id as string}
          businessName={business.name as string}
          status={business.status as string}
        />
      )}
      {children}
    </BusinessStatusProvider>
  );
}
