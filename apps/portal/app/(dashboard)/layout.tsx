import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { PortalSidebar } from "@/_components/portal-sidebar";

/**
 * Portal dashboard layout (Server Component).
 *
 * Defense in depth: validates auth via getUser() against Supabase Auth server
 * rather than relying solely on middleware session refresh.
 *
 * Resolves the user's associated business from the business_users table.
 * Business owners are scoped to a single business in the portal.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  // Validate session server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Resolve the user's primary business (first owner membership found)
  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id, role, businesses(id, name, status)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  // If no owner membership found, try any membership
  let businessName = "My Business";
  if (!membership) {
    const { data: anyMembership } = await supabase
      .from("business_users")
      .select("business_id, businesses(id, name, status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!anyMembership) {
      // No business associated -- show a placeholder state
      // TODO: redirect to an onboarding/no-access page when that route exists
      businessName = "No Business";
    } else {
      const biz = anyMembership.businesses as unknown as {
        name: string;
      } | null;
      businessName = biz?.name ?? "My Business";
    }
  } else {
    const biz = membership.businesses as unknown as { name: string } | null;
    businessName = biz?.name ?? "My Business";
  }

  return (
    <div className="flex min-h-screen">
      <PortalSidebar
        businessName={businessName}
        user={{
          email: user.email ?? "",
          full_name: user.user_metadata?.full_name as string | null,
        }}
      />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
