"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Activity,
  LogOut,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/_lib/supabase/client";

interface PortalSidebarProps {
  businessName: string;
  user: {
    email: string;
    full_name?: string | null;
  };
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users, exact: false },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: Kanban, exact: false },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare, exact: false },
  { href: "/dashboard/activity", label: "Activity", icon: Activity, exact: false },
] as const;

/** Extract initials from a name or email address */
function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email?.[0] ?? "?").toUpperCase();
}

/**
 * Portal sidebar navigation.
 *
 * Fixed left sidebar with business branding, main nav links,
 * and a user sign-out control at the bottom.
 */
export function PortalSidebar({ businessName, user }: PortalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = getInitials(user.full_name, user.email);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <aside className="flex w-60 flex-col border-r bg-muted/30">
      {/* Business brand header */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-semibold tracking-tight">
          {businessName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t p-3">
        <div className="mb-2 flex items-center gap-2 rounded-md px-3 py-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {initials}
          </span>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
