"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getAdapter } from "@agency-factory/core";
import type { IntegrationType } from "@agency-factory/core";
import {
  saveIntegrationAction,
  deleteIntegrationAction,
} from "@/_actions/integration-actions";
import { IntegrationCatalogDialog } from "@/_components/integration-catalog-dialog";

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
}

interface Department {
  id: string;
  name: string;
  type: string;
}

interface AgentTarget {
  id: string;
  name: string;
  department_id: string;
}

interface AgentIntegrationsProps {
  agentId: string;
  businessId: string;
  integrations: Integration[];
  departments: Department[];
  agents: AgentTarget[];
}

const INTEGRATION_TYPES: { type: IntegrationType; label: string }[] = [
  { type: "crm", label: "CRM" },
  { type: "email", label: "Email" },
  { type: "helpdesk", label: "Helpdesk" },
  { type: "calendar", label: "Calendar" },
  { type: "messaging", label: "Messaging" },
];

const PROVIDER_OPTIONS: Record<string, { value: string; label: string }[]> = {
  crm: [
    { value: "mock", label: "Mock CRM" },
    { value: "salesforce", label: "Salesforce" },
    { value: "hubspot", label: "HubSpot" },
  ],
  email: [
    { value: "mock", label: "Mock Email" },
    { value: "sendgrid", label: "SendGrid" },
    { value: "ses", label: "AWS SES" },
  ],
  helpdesk: [
    { value: "mock", label: "Mock Helpdesk" },
    { value: "zendesk", label: "Zendesk" },
    { value: "freshdesk", label: "Freshdesk" },
  ],
  calendar: [
    { value: "mock", label: "Mock Calendar" },
    { value: "google", label: "Google Calendar" },
    { value: "outlook", label: "Outlook Calendar" },
  ],
  messaging: [
    { value: "mock", label: "Mock Messaging" },
    { value: "slack", label: "Slack" },
    { value: "teams", label: "Microsoft Teams" },
  ],
};

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

/**
 * Per-agent Integrations tab content.
 *
 * Shows 5 integration type sections (CRM, Email, Helpdesk, Calendar, Messaging).
 * Configured integrations show provider dropdown, status, capabilities, and sample data.
 * Unconfigured types show a prompt to use the "Add from Catalog" button.
 */
export function AgentIntegrations({
  agentId,
  businessId,
  integrations,
  departments,
  agents,
}: AgentIntegrationsProps) {
  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Integration Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure integration providers for each type.
          </p>
        </div>
        <IntegrationCatalogDialog
          businessId={businessId}
          departments={departments}
          agents={agents}
          preSelectedAgentId={agentId}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 size-3.5" />
              Add from Catalog
            </Button>
          }
        />
      </div>

      {INTEGRATION_TYPES.map(({ type, label }) => {
        const existing = integrations.find((i) => i.type === type);
        return (
          <IntegrationTypeSection
            key={type}
            type={type}
            label={label}
            integration={existing ?? null}
            agentId={agentId}
            businessId={businessId}
          />
        );
      })}
    </div>
  );
}

function IntegrationTypeSection({
  type,
  label,
  integration,
  agentId,
  businessId,
}: {
  type: IntegrationType;
  label: string;
  integration: Integration | null;
  agentId: string;
  businessId: string;
}) {
  const [selectedProvider, setSelectedProvider] = useState(
    integration?.provider ?? ""
  );
  const [isPending, startTransition] = useTransition();
  const [showComingSoon, setShowComingSoon] = useState(false);
  const router = useRouter();

  const adapter = getAdapter(type);
  const capabilities = adapter.getCapabilities();
  const sampleData = adapter.getSampleData();

  function handleProviderChange(value: string | null) {
    if (!value) return;
    if (value !== "mock" && !value.startsWith("mock")) {
      setSelectedProvider(value);
      setShowComingSoon(true);
    } else {
      setSelectedProvider(value);
      setShowComingSoon(false);
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveIntegrationAction(businessId, agentId, type, selectedProvider);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Integration saved");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!integration) return;
    startTransition(async () => {
      const result = await deleteIntegrationAction(businessId, integration.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Integration removed");
        router.refresh();
      }
    });
  }

  if (!integration) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription>
                Not configured -- use Add from Catalog above
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{label}</CardTitle>
            <Badge
              variant="outline"
              className={statusColor(integration.status)}
            >
              {integration.status}
            </Badge>
          </div>
          {integration.status !== "mock" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">
            Provider
          </label>
          <Select
            value={selectedProvider || integration.provider}
            onValueChange={handleProviderChange}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS[type]?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              isPending ||
              selectedProvider === integration.provider ||
              showComingSoon
            }
          >
            {isPending && (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            )}
            Save
          </Button>
        </div>

        {/* Coming soon message for real providers */}
        {showComingSoon && (
          <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-sm text-yellow-600">
            Coming soon -- configure credentials in Settings &gt; Secrets
          </div>
        )}

        {/* Capabilities */}
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Capabilities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {capabilities.map((cap) => (
              <Badge key={cap} variant="secondary" className="text-xs">
                {cap}
              </Badge>
            ))}
          </div>
        </div>

        {/* Sample data preview */}
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Sample Data
          </p>
          <pre className="max-h-32 overflow-auto rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            {JSON.stringify(sampleData, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
