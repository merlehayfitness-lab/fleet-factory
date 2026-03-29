"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { getAdapter } from "@agency-factory/core";
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
 * Shows agent or department name, integration type, provider, status, and capabilities.
 * Handles both agent-level and department-level integrations.
 */
export function IntegrationConfigCard({
  integration,
  businessId,
}: IntegrationConfigCardProps) {
  const isDepartmentLevel = !integration.agent_id && integration.departments;
  const departmentName = integration.departments?.name;
  const agentName = integration.agents?.name ?? "Unknown Agent";
  const agentId = integration.agents?.id ?? integration.agent_id;

  // Display name: use catalog name if available, otherwise provider
  const displayName = integration.name ?? integration.provider;

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
          {isDepartmentLevel ? (
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Building2 className="size-3.5 text-muted-foreground" />
              <span>Department: {departmentName}</span>
            </div>
          ) : (
            <Link
              href={`/businesses/${businessId}/agents/${agentId}`}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {agentName}
            </Link>
          )}
          <Badge
            variant="outline"
            className={statusColor(integration.status)}
          >
            {integration.status}
          </Badge>
        </div>
        <CardTitle className="text-xs font-normal text-muted-foreground">
          {displayName}
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
