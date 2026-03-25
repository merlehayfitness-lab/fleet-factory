import Link from "next/link";
import {
  Rocket,
  Bot,
  Users,
  Shield,
  ScrollText,
  CheckSquare,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge } from "@/_components/status-badge";

interface Deployment {
  id: string;
  status: string;
  version: string | null;
  created_at: string;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  status: string;
  created_at: string;
}

interface BusinessOverviewProps {
  business: Business;
  agentCount: number;
  departmentCount: number;
  latestDeployment: Deployment | null;
  pendingApprovalCount: number;
}

/**
 * Business overview dashboard.
 *
 * Displays business name with status, stats cards (deployment, agents,
 * departments, approvals), quick links, and a recent activity placeholder.
 */
export function BusinessOverview({
  business,
  agentCount,
  departmentCount,
  latestDeployment,
  pendingApprovalCount,
}: BusinessOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
        <StatusBadge status={business.status} />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Rocket className="size-3.5" />
              Deployment Status
            </CardDescription>
            <CardTitle>
              {latestDeployment ? (
                <StatusBadge status={latestDeployment.status} />
              ) : (
                <span className="text-sm text-muted-foreground">
                  No deployments
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Bot className="size-3.5" />
              Active Agents
            </CardDescription>
            <CardTitle>{agentCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              Departments
            </CardDescription>
            <CardTitle>{departmentCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Shield className="size-3.5" />
              Pending Approvals
            </CardDescription>
            <CardTitle>{pendingApprovalCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Quick Links</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLinkCard
            href={`/businesses/${business.id}/agents`}
            label="Agents"
            description="View and manage agents"
            icon={Bot}
            enabled
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/departments`}
            label="Departments"
            description="View and manage departments"
            icon={Users}
            enabled
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/deployments`}
            label="Deployments"
            description="Manage deployments"
            icon={Rocket}
            enabled
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/tasks`}
            label="Tasks"
            description="Coming in Phase 4"
            icon={CheckSquare}
            enabled={false}
          />
          <QuickLinkCard
            href={`/businesses/${business.id}/logs`}
            label="Logs"
            description="Coming in Phase 5"
            icon={ScrollText}
            enabled={false}
          />
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
        <Card>
          <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Activity className="mr-2 size-4" />
            No recent activity
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickLinkCard({
  href,
  label,
  description,
  icon: Icon,
  enabled,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}) {
  if (!enabled) {
    return (
      <Card className="opacity-50">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <Icon className="size-3.5" />
            {label}
          </CardDescription>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {description}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <Icon className="size-3.5" />
            {label}
          </CardDescription>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {description}
          </CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}
