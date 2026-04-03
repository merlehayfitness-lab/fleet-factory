import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { BusinessStatusProvider } from "@/_components/business-status-provider";
import { SuspendedBanner } from "@/_components/suspended-banner";

/**
 * Business-specific layout.
 */
export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  let business: { id: string; name: string; status: string } | null = null;

  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, status")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("[BusinessLayout] Failed to load business:", error?.message);
      notFound();
    }

    business = data as { id: string; name: string; status: string };
  } catch (e) {
    // Re-throw Next.js navigation errors (notFound, redirect)
    const digest = (e as { digest?: string })?.digest ?? "";
    if (digest.startsWith("NEXT_")) throw e;
    console.error("[BusinessLayout] Unexpected error:", e);
    // Render children without the provider as fallback
    return <>{children}</>;
  }

  const isDisabled =
    business.status === "disabled" || business.status === "suspended";

  return (
    <BusinessStatusProvider
      status={business.status}
      businessId={business.id}
      businessName={business.name}
    >
      {isDisabled && (
        <SuspendedBanner
          businessId={business.id}
          businessName={business.name}
          status={business.status}
        />
      )}
      {children}
    </BusinessStatusProvider>
  );
}
