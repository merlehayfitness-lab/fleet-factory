"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CredentialForm } from "@/_components/credential-form";
import {
  revealSecretAction,
  testConnectionAction,
  deleteProviderSecretsAction,
  saveProviderCredentialsAction,
} from "@/_actions/secrets-actions";
import { INTEGRATION_CATALOG } from "@agency-factory/core";
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

interface ProviderSecretsCardProps {
  provider: string;
  secrets: Secret[];
  fields: CredentialField[];
  businessId: string;
}

/** 5 seconds reveal duration */
const REVEAL_DURATION_MS = 5000;

/**
 * Collapsible provider card with credential fields, eye toggle, edit, delete.
 *
 * Collapsed: provider name, logo, connection status badge, last updated.
 * Expanded: CredentialForm for editing + action buttons.
 */
export function ProviderSecretsCard({
  provider,
  secrets,
  fields,
  businessId,
}: ProviderSecretsCardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Eye toggle state: field_name -> revealed plaintext
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>(
    {},
  );
  const [revealingField, setRevealingField] = useState<string | null>(null);
  const revealTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  // Look up provider display info from catalog
  const catalogEntry = INTEGRATION_CATALOG.find(
    (e) => e.provider === provider,
  );
  const displayName = catalogEntry?.name ?? provider;
  const logoUrl = catalogEntry?.logoUrl;

  // Connection status: green if secrets exist
  const isConnected = secrets.length > 0;

  // Most recent update
  const lastUpdated = secrets.reduce(
    (latest, s) => {
      const dt = new Date(s.updated_at).getTime();
      return dt > latest ? dt : latest;
    },
    0,
  );
  const lastUpdatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString()
    : null;

  // --- Eye toggle handler ---
  const handleReveal = useCallback(
    async (secret: Secret) => {
      const fieldName = secret.key;

      // If already revealed, re-mask immediately
      if (revealedValues[fieldName]) {
        setRevealedValues((prev) => {
          const next = { ...prev };
          delete next[fieldName];
          return next;
        });
        // Clear existing timer
        if (revealTimers.current[fieldName]) {
          clearTimeout(revealTimers.current[fieldName]);
          delete revealTimers.current[fieldName];
        }
        return;
      }

      // Fetch decrypted value from server
      setRevealingField(fieldName);
      const result = await revealSecretAction(businessId, secret.id);
      setRevealingField(null);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      // Cache and display for REVEAL_DURATION_MS
      setRevealedValues((prev) => ({ ...prev, [fieldName]: result.value }));

      // Auto-re-mask after 5 seconds
      revealTimers.current[fieldName] = setTimeout(() => {
        setRevealedValues((prev) => {
          const next = { ...prev };
          delete next[fieldName];
          return next;
        });
        delete revealTimers.current[fieldName];
      }, REVEAL_DURATION_MS);
    },
    [businessId, revealedValues],
  );

  // --- Test connection ---
  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    const result = await testConnectionAction(businessId, provider);
    setIsTesting(false);

    if ("error" in result) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success(result.message ?? "Connection successful");
    } else {
      toast.error(result.message ?? "Connection failed");
    }
  }, [businessId, provider]);

  // --- Delete all credentials ---
  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const result = await deleteProviderSecretsAction(businessId, provider);
    setIsDeleting(false);
    setShowDeleteDialog(false);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(`${displayName} credentials deleted. Integration deactivated.`);
      router.refresh();
    }
  }, [businessId, provider, displayName, router]);

  // --- Save credentials ---
  const handleSave = useCallback(
    async (values: Record<string, string>) => {
      setIsSaving(true);
      const result = await saveProviderCredentialsAction(
        businessId,
        provider,
        values,
      );
      setIsSaving(false);

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${displayName} credentials saved`);
        router.refresh();
      }
    },
    [businessId, provider, displayName, router],
  );

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full text-left">
            <CardHeader className="flex flex-row items-center gap-3 cursor-pointer hover:bg-accent/30 transition-colors">
              {/* Expand chevron */}
              <ChevronRight
                className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />

              {/* Provider logo */}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={displayName}
                  className="size-8 rounded object-contain"
                />
              )}

              {/* Provider name and metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{displayName}</span>
                  <Badge
                    variant={isConnected ? "default" : "outline"}
                    className={
                      isConnected
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs"
                        : "text-xs"
                    }
                  >
                    {isConnected ? "Connected" : "Not configured"}
                  </Badge>
                </div>
                {lastUpdatedStr && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last updated {lastUpdatedStr}
                  </p>
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {/* Eye toggle per field */}
              {secrets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Stored Credentials
                  </p>
                  {secrets.map((secret) => {
                    const isRevealed = !!revealedValues[secret.key];
                    const isRevealing = revealingField === secret.key;
                    const fieldDef = fields.find(
                      (f) => f.field_name === secret.key,
                    );

                    return (
                      <div
                        key={secret.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium">
                            {fieldDef?.display_label ?? secret.key}
                          </span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {isRevealed
                              ? revealedValues[secret.key]
                              : "****"}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleReveal(secret);
                          }}
                          disabled={isRevealing}
                        >
                          {isRevealing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : isRevealed ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Credential form for editing */}
              {fields.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {secrets.length > 0
                      ? "Update Credentials"
                      : "Enter Credentials"}
                  </p>
                  <CredentialForm
                    fields={fields}
                    existingSecrets={secrets}
                    onSave={handleSave}
                    isSaving={isSaving}
                    revealedValues={revealedValues}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting || secrets.length === 0}
                  className="gap-1.5"
                >
                  {isTesting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : isConnected ? (
                    <Wifi className="size-3.5" />
                  ) : (
                    <WifiOff className="size-3.5" />
                  )}
                  Test Connection
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={secrets.length === 0}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete All Credentials
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All {displayName} Credentials</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all stored credentials for {displayName} and
              deactivate its integration. You will need to re-enter
              credentials to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
