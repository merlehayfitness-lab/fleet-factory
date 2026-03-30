"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, BookOpen, Settings2 } from "lucide-react";
import { getAdapter } from "@agency-factory/core";
import type { IntegrationType } from "@agency-factory/core";
import { CatalogInstructionsPanel } from "@/_components/catalog-instructions-panel";

interface Integration {
  id: string;
  business_id: string;
  agent_id: string | null;
  department_id?: string | null;
  type: string;
  provider: string;
  name?: string | null;
  setup_instructions?: string | null;
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
  onConfigure?: (provider: string) => void;
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
  onConfigure,
}: IntegrationConfigCardProps) {
  const [setupOpen, setSetupOpen] = useState(false);
  const isDepartmentLevel = !integration.agent_id && integration.departments;
  const departmentName = integration.departments?.name;
  const agentName = integration.agents?.name ?? "Unknown Agent";
  const agentId = integration.agents?.id ?? integration.agent_id;

  // Display name: use catalog name if available, otherwise provider
  const displayName = integration.name ?? integration.provider;

  // Target context for instructions
  const instrTargetName = isDepartmentLevel
    ? `${departmentName} Department`
    : agentName;
  const instrTargetType = isDepartmentLevel ? "department" : "agent";

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
    <>
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
            <div className="flex items-center gap-1.5">
              {onConfigure && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
                  onClick={() => onConfigure(integration.provider)}
                >
                  <Settings2 className="size-3" />
                  Configure
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
                onClick={() => setSetupOpen(true)}
              >
                <BookOpen className="size-3" />
                View Setup
              </Button>
              <Badge
                variant="outline"
                className={statusColor(integration.status)}
              >
                {integration.status}
              </Badge>
            </div>
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

      {/* Setup Instructions Dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{displayName} Setup Guide</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {setupOpen && (
              <CatalogInstructionsPanel
                integrationId={integration.id}
                businessId={businessId}
                integrationName={displayName}
                integrationCategory={integration.type}
                provider={integration.provider}
                targetName={instrTargetName}
                targetType={instrTargetType}
                existingInstructions={
                  integration.setup_instructions ?? undefined
                }
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
