"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Power, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/_components/status-badge";
import { TypeToConfirmDialog } from "@/_components/type-to-confirm-dialog";
import { SecretsManager } from "@/_components/secrets-manager";
import {
  disableTenantAction,
  restoreTenantAction,
} from "@/_actions/emergency-actions";
import { toast } from "sonner";

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

interface SettingsPageProps {
  business: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  groupedSecrets: Record<string, Secret[]>;
  providerFields: Record<string, CredentialField[]>;
}

/**
 * Settings page client component.
 *
 * Two sections:
 * 1. Emergency Controls -- tenant-level disable/restore
 * 2. Secrets & Credentials -- provider-grouped secrets manager
 */
export function SettingsPage({
  business,
  groupedSecrets,
  providerFields,
}: SettingsPageProps) {
  const [showDisableTenant, setShowDisableTenant] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const isDisabled = business.status === "disabled";

  const handleDisableTenant = useCallback(
    async (reason: string) => {
      setIsPending(true);
      const result = await disableTenantAction(business.id, reason);
      setIsPending(false);
      setShowDisableTenant(false);

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Tenant disabled. All agents have been frozen.");
        router.refresh();
      }
    },
    [business.id, router],
  );

  const handleRestoreTenant = useCallback(async () => {
    setIsPending(true);
    const result = await restoreTenantAction(business.id);
    setIsPending(false);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(
        "Tenant restored. Agents remain frozen for manual review.",
      );
      router.refresh();
    }
  }, [business.id, router]);

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage emergency controls and credentials for {business.name}
        </p>
      </div>

      {/* Section 1: Emergency Controls */}
      <section id="emergency-controls">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Emergency Controls</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Tenant Status
            </CardTitle>
            <CardDescription>
              Control the operational status of this business tenant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Current Status:</span>
              <StatusBadge status={business.status} />
            </div>

            {isDisabled ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This tenant is currently disabled. All agents are frozen and
                  users have lost access. Restoring the tenant will re-enable
                  access, but agents will remain frozen for manual review.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreTenant}
                  disabled={isPending}
                  className="gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <RotateCcw className="size-3.5" />
                  {isPending ? "Restoring..." : "Restore Tenant"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Disabling this tenant will freeze all active agents and
                  prevent users from accessing the business. This is a
                  reversible emergency action.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDisableTenant(true)}
                  disabled={isPending}
                  className="gap-1.5"
                >
                  <Power className="size-3.5" />
                  Disable Tenant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant disable confirmation dialog */}
        <TypeToConfirmDialog
          open={showDisableTenant}
          onOpenChange={setShowDisableTenant}
          title="Disable Tenant"
          description={`This will disable the entire "${business.name}" business and freeze all active agents. Users will lose access until the tenant is restored. Agents will remain frozen for manual review after restoration.`}
          confirmPhrase="DISABLE ALL"
          actionLabel="Disable Tenant"
          variant="destructive"
          onConfirm={handleDisableTenant}
          isPending={isPending}
        />
      </section>

      {/* Section 2: Secrets & Credentials */}
      <section id="secrets">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Secrets & Credentials</h2>
        </div>

        <SecretsManager
          groupedSecrets={groupedSecrets}
          providerFields={providerFields}
          businessId={business.id}
        />
      </section>
    </div>
  );
}
