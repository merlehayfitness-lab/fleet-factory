"use client";

import { Lock, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProviderSecretsCard } from "@/_components/provider-secrets-card";

interface Secret {
  id: string;
  business_id: string;
  key: string;
  encrypted_value: string;
  category: string;
  integration_type: string | null;
  provider: string | null;
  created_at: string;
  updated_at: string;
}

interface CredentialField {
  id: string;
  provider: string;
  field_name: string;
  field_type: "password" | "text" | "url";
  display_label: string;
  placeholder: string | null;
  help_text: string | null;
  field_order: number;
}

interface SecretsManagerProps {
  groupedSecrets: Record<string, Secret[]>;
  providerFields: Record<string, CredentialField[]>;
  businessId: string;
}

/**
 * Provider-grouped secrets manager.
 *
 * Renders only configured providers (providers with saved credentials).
 * Each provider gets a collapsible ProviderSecretsCard.
 * Legacy secrets (provider = null, grouped as "legacy") shown separately at bottom.
 * No "Add Integration" button -- adding providers is done from the Integrations page.
 */
export function SecretsManager({
  groupedSecrets,
  providerFields,
  businessId,
}: SecretsManagerProps) {
  // Separate provider secrets from legacy secrets
  const legacySecrets = groupedSecrets["legacy"] ?? [];
  const providerEntries = Object.entries(groupedSecrets).filter(
    ([key]) => key !== "legacy",
  );

  const hasAnySecrets =
    providerEntries.length > 0 || legacySecrets.length > 0;

  if (!hasAnySecrets) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <Lock className="mb-2 size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No credentials configured.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Add integrations from the Integrations page to set up credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Provider-grouped cards */}
      {providerEntries.map(([provider, secrets]) => (
        <ProviderSecretsCard
          key={provider}
          provider={provider}
          secrets={secrets}
          fields={providerFields[provider] ?? []}
          businessId={businessId}
        />
      ))}

      {/* Legacy credentials section */}
      {legacySecrets.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Key className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Legacy Credentials</h3>
            <Badge variant="outline" className="text-xs">
              {legacySecrets.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {legacySecrets.map((secret) => (
              <div
                key={secret.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold">
                    {secret.key}
                  </span>
                  {secret.integration_type && (
                    <Badge variant="outline" className="text-xs">
                      {secret.integration_type}
                    </Badge>
                  )}
                  {secret.category && (
                    <Badge variant="outline" className="text-xs">
                      {secret.category}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    ****
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(secret.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
