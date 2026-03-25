import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { signOut } from "@/_actions/auth-actions";
import { Button } from "@/components/ui/button";

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
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-muted/30">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-sm font-semibold tracking-tight">
            Agency Factory
          </span>
        </div>

        <nav className="flex-1 p-4">
          {/* Navigation links will be added in future plans */}
        </nav>

        <div className="border-t p-4">
          <p className="mb-2 truncate text-xs text-muted-foreground">
            {user.email}
          </p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
