"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdapter } from "@agency-factory/core";
import type { IntegrationType } from "@agency-factory/core";

interface Integration {
  id: string;
  business_id: string;
  agent_id: string;
  type: string;
  provider: string;
  config: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
  agents: { id: string; name: string } | null;
}

interface IntegrationConfigCardProps {
  integration: Integration;
  businessId: string;
}

function statusColor(status: string): string {
  switch (status) {
    case "mock":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "active":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const MAX_VISIBLE_CAPABILITIES = 3;

/**
 * Read-only card for a single integration entry in the business-wide overview.
 *
 * Shows agent name (as link), integration type, provider, status, and capabilities.
 * Editing happens on the agent's Integrations tab, not here.
 */
export function IntegrationConfigCard({
  integration,
  businessId,
}: IntegrationConfigCardProps) {
  const agentName = integration.agents?.name ?? "Unknown Agent";
  const agentId = integration.agents?.id ?? integration.agent_id;

  let capabilities: string[] = [];
  try {
    const adapter = getAdapter(integration.type as IntegrationType);
    capabilities = adapter.getCapabilities();
  } catch {
    // If type is unknown, just show empty capabilities
  }

  const visibleCaps = capabilities.slice(0, MAX_VISIBLE_CAPABILITIES);
  const overflowCount = capabilities.length - MAX_VISIBLE_CAPABILITIES;

  return (
    <Card className="transition-colors hover:bg-accent/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Link
            href={`/businesses/${businessId}/agents/${agentId}`}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {agentName}
          </Link>
          <Badge
            variant="outline"
            className={statusColor(integration.status)}
          >
            {integration.status}
          </Badge>
        </div>
        <CardTitle className="text-xs font-normal text-muted-foreground">
          {integration.provider}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Capabilities chips */}
        <div className="flex flex-wrap gap-1">
          {visibleCaps.map((cap) => (
            <Badge
              key={cap}
              variant="secondary"
              className="text-[10px] font-normal"
            >
              {cap}
            </Badge>
          ))}
          {overflowCount > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] font-normal text-muted-foreground"
            >
              +{overflowCount} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
