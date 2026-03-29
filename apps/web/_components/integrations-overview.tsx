"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrationConfigCard } from "@/_components/integration-config-card";
import type { IntegrationType } from "@agency-factory/core";

interface Integration {
  id: string;
  business_id: string;
  agent_id: string | null;
  department_id?: string | null;
  type: string;
  provider: string;
  name?: string | null;
  config: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
  agents: { id: string; name: string } | null;
  departments?: { id: string; name: string } | null;
}

interface Agent {
  id: string;
  name: string;
  status: string;
}

interface IntegrationsOverviewProps {
  integrations: Integration[];
  agents: Agent[];
  businessId: string;
}

const INTEGRATION_TYPES: { type: IntegrationType; label: string }[] = [
  { type: "crm", label: "CRM" },
  { type: "email", label: "Email" },
  { type: "helpdesk", label: "Helpdesk" },
  { type: "calendar", label: "Calendar" },
  { type: "messaging", label: "Messaging" },
];

/**
 * Business-wide integrations overview.
 *
 * Groups all integrations by type, shows summary stats,
 * and handles both agent-level and department-level integrations.
 */
export function IntegrationsOverview({
  integrations,
  agents,
  businessId,
}: IntegrationsOverviewProps) {
  const agentIntegrations = integrations.filter((i) => i.agent_id);
  const departmentIntegrations = integrations.filter(
    (i) => !i.agent_id && i.department_id
  );
  const agentsWithIntegrations = new Set(
    agentIntegrations.map((i) => i.agent_id)
  );
  const agentsWithoutIntegrations = agents.filter(
    (a) => !agentsWithIntegrations.has(a.id)
  );

  // Empty state
  if (integrations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No integrations configured yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the &quot;Add Integration&quot; button above to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Integrations</CardDescription>
            <CardTitle>{integrations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Agent-level</CardDescription>
            <CardTitle>{agentIntegrations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Department-level</CardDescription>
            <CardTitle>{departmentIntegrations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Agents without Integrations</CardDescription>
            <CardTitle>{agentsWithoutIntegrations.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Grouped by type */}
      {INTEGRATION_TYPES.map(({ type, label }) => {
        const typeIntegrations = integrations.filter(
          (i) => i.type === type
        );
        const configuredAgentIds = new Set(
          typeIntegrations.filter((i) => i.agent_id).map((i) => i.agent_id)
        );
        const unconfiguredAgents = agents.filter(
          (a) => !configuredAgentIds.has(a.id)
        );

        return (
          <div key={type} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{label}</h2>
              <Badge variant="secondary" className="text-xs">
                {typeIntegrations.length} configured
              </Badge>
            </div>

            {typeIntegrations.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No {label.toLowerCase()} integrations configured.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {typeIntegrations.map((integration) => (
                  <IntegrationConfigCard
                    key={integration.id}
                    integration={integration}
                    businessId={businessId}
                  />
                ))}
              </div>
            )}

            {/* Unconfigured agents for this type */}
            {unconfiguredAgents.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Not configured:</span>
                {unconfiguredAgents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/businesses/${businessId}/agents/${agent.id}`}
                    className="rounded-md border px-2 py-0.5 transition-colors hover:bg-accent/50"
                  >
                    {agent.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
