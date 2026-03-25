import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { SidebarNav } from "@/_components/sidebar-nav";

/**
 * Protected dashboard layout.
 *
 * Defense in depth: checks auth via getUser() (validates with Supabase Auth
 * server) in addition to middleware session refresh. This protects against
 * CVE-2025-29927 middleware bypass attacks.
 *
 * Wraps all /businesses/* routes.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen">
      <SidebarNav
        user={{
          email: user.email ?? "",
          full_name: user.user_metadata?.full_name as string | null,
        }}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
