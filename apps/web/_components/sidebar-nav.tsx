"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Users,
  Bot,
  FileText,
  Rocket,
  Plug,
  Shield,
  CheckSquare,
  ScrollText,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/_actions/auth-actions";

interface SidebarNavProps {
  user: {
    email: string;
    full_name?: string | null;
  };
}

/** Extract the business ID from a pathname like /businesses/abc-123/... */
function extractBusinessId(pathname: string): string | null {
  const match = pathname.match(/^\/businesses\/([^/]+)/);
  return match?.[1] ?? null;
}

/** Get user initials from name or email */
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

const MAIN_NAV = [
  { href: "/businesses", label: "Businesses", icon: Building2 },
] as const;

function getBusinessSubNav(businessId: string) {
  return [
    {
      href: `/businesses/${businessId}`,
      label: "Overview",
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/departments`,
      label: "Departments",
      icon: Users,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/agents`,
      label: "Agents",
      icon: Bot,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/templates`,
      label: "Templates",
      icon: FileText,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/deployments`,
      label: "Deployments",
      icon: Rocket,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/integrations`,
      label: "Integrations",
      icon: Plug,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/approvals`,
      label: "Approvals",
      icon: Shield,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/tasks`,
      label: "Tasks",
      icon: CheckSquare,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/chat`,
      label: "Chat",
      icon: MessageSquare,
      enabled: true,
    },
    {
      href: `/businesses/${businessId}/logs`,
      label: "Logs",
      icon: ScrollText,
      enabled: true,
    },
  ] as const;
}

/**
 * Dashboard sidebar navigation.
 *
 * Shows main nav links and, when viewing a specific business,
 * sub-navigation for that business. Includes a user menu at the bottom.
 */
export function SidebarNav({ user }: SidebarNavProps) {
  const pathname = usePathname();
  const businessId = extractBusinessId(pathname);
  const initials = getInitials(user.full_name, user.email);

  return (
    <aside className="flex w-64 flex-col border-r bg-muted/30">
      {/* Brand */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/businesses" className="text-sm font-semibold tracking-tight">
          Agency Factory
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {/* Main navigation */}
        {MAIN_NAV.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        {/* Business sub-navigation */}
        {businessId && (
          <div className="mt-4 space-y-1 border-t pt-4">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Business
            </p>
            {getBusinessSubNav(businessId).map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (!item.enabled) {
                return (
                  <span
                    key={item.href}
                    className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50">
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-left text-xs text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuLabel>{user.full_name ?? user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const form = document.createElement("form");
                form.method = "POST";
                form.action = "";
                document.body.appendChild(form);
                // Use the signOut server action via a hidden form submission
                // Instead, we'll just call fetch to the sign-out action
                void signOutAction();
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

/**
 * Wraps the signOut server action for client-side invocation.
 * Server Actions can be called directly from client components.
 */
async function signOutAction() {
  await signOut();
}
