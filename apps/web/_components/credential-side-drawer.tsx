"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { X, Loader2, Plug, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INTEGRATION_CATALOG,
  type CatalogEntry,
} from "@agency-factory/core";
import {
  getProviderFieldsAction,
  getSecretsByProviderAction,
  saveProviderCredentialsAction,
  testConnectionAction,
} from "@/_actions/secrets-actions";

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

interface SecretRow {
  id: string;
  key: string;
  encrypted_value: string;
  category: string;
  provider: string | null;
}

interface CredentialSideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  provider: string | null;
  businessId: string;
}

/**
 * Right-side sliding drawer with dynamic credential form for integration configuration.
 *
 * Opens when clicking "Configure" on an integration card. Fetches provider field
 * definitions from the database, shows dynamic form fields, saves encrypted credentials,
 * and auto-creates integration records on save.
 */
export function CredentialSideDrawer({
  isOpen,
  onClose,
  provider,
  businessId,
}: CredentialSideDrawerProps) {
  const [fields, setFields] = useState<CredentialField[]>([]);
  const [existingSecrets, setExistingSecrets] = useState<SecretRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  // Look up catalog entry for display info
  const catalogEntry: CatalogEntry | undefined = provider
    ? INTEGRATION_CATALOG.find((e) => e.provider === provider)
    : undefined;

  // Fetch field definitions and existing secrets when provider changes
  useEffect(() => {
    if (!isOpen || !provider) {
      setFields([]);
      setExistingSecrets([]);
      setValues({});
      setRevealed({});
      setHasExisting(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);

      const [fieldsResult, secretsResult] = await Promise.all([
        getProviderFieldsAction(provider!),
        getSecretsByProviderAction(businessId),
      ]);

      if (cancelled) return;

      if (fieldsResult.fields) {
        setFields(fieldsResult.fields);
      }

      // Filter secrets to current provider
      const providerSecrets: SecretRow[] = [];
      if (secretsResult.secrets) {
        // secretsResult.secrets is grouped by provider
        const grouped = secretsResult.secrets as Record<string, SecretRow[]>;
        if (grouped[provider!]) {
          providerSecrets.push(...grouped[provider!]);
        }
      }

      setExistingSecrets(providerSecrets);
      setHasExisting(providerSecrets.length > 0);

      // Pre-fill values with masked placeholders for existing secrets
      const initialValues: Record<string, string> = {};
      if (fieldsResult.fields) {
        for (const field of fieldsResult.fields) {
          const existingSecret = providerSecrets.find(
            (s) => s.key === field.field_name
          );
          initialValues[field.field_name] = existingSecret
            ? "••••••••"
            : "";
        }
      }
      setValues(initialValues);
      setRevealed({});
      setLoading(false);
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, provider, businessId]);

  // Escape key closes drawer
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleFieldChange = useCallback(
    (fieldName: string, value: string) => {
      setValues((prev) => ({ ...prev, [fieldName]: value }));
    },
    []
  );

  const toggleReveal = useCallback((fieldName: string) => {
    setRevealed((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  }, []);

  async function handleSave() {
    if (!provider) return;

    // Validate all fields have values (excluding masked placeholders for existing)
    const credentials: Record<string, string> = {};
    let hasEmpty = false;

    for (const field of fields) {
      const val = values[field.field_name] ?? "";
      if (!val || val === "••••••••") {
        // If it's a masked existing value and hasn't been edited, skip it
        const existingSecret = existingSecrets.find(
          (s) => s.key === field.field_name
        );
        if (existingSecret && val === "••••••••") {
          // User hasn't changed this field -- don't include in save
          continue;
        }
        hasEmpty = true;
        break;
      }
      credentials[field.field_name] = val;
    }

    if (hasEmpty) {
      toast.error("All credential fields are required");
      return;
    }

    // If no fields were changed (all masked), inform user
    if (Object.keys(credentials).length === 0 && hasExisting) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    const result = await saveProviderCredentialsAction(
      businessId,
      provider,
      credentials
    );
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const providerName = catalogEntry?.name ?? provider;
    if (hasExisting) {
      toast.success(`Credentials updated for ${providerName}`);
    } else {
      toast.success(
        `Credentials saved and ${providerName} integration activated`
      );
    }

    onClose();
  }

  async function handleTestConnection() {
    if (!provider) return;

    setTesting(true);
    const result = await testConnectionAction(businessId, provider);
    setTesting(false);

    if ("error" in result) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success(result.message ?? "Connection successful");
    } else {
      toast.error(result.message ?? "Connection test failed");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="relative z-10 flex w-full max-w-[420px] flex-col bg-popover shadow-xl ring-1 ring-foreground/10">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            {catalogEntry?.logoUrl && (
              <img
                src={catalogEntry.logoUrl}
                alt={catalogEntry.name}
                className="size-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div>
              <h3 className="text-base font-semibold">
                {catalogEntry?.name ?? provider ?? "Configure Integration"}
              </h3>
              {catalogEntry?.description && (
                <p className="text-xs text-muted-foreground">
                  {catalogEntry.description}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading credential fields...
              </p>
            </div>
          ) : fields.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No credential fields defined for this provider.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {hasExisting && (
                <p className="text-xs text-muted-foreground">
                  Existing credentials are masked. Clear a field and enter a new
                  value to update it.
                </p>
              )}

              {fields.map((field) => {
                const isPassword = field.field_type === "password";
                const isRevealed = revealed[field.field_name] ?? false;

                return (
                  <div key={field.id} className="space-y-1.5">
                    <Label htmlFor={`field-${field.field_name}`}>
                      {field.display_label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`field-${field.field_name}`}
                        type={
                          isPassword && !isRevealed ? "password" : "text"
                        }
                        value={values[field.field_name] ?? ""}
                        onChange={(e) =>
                          handleFieldChange(
                            field.field_name,
                            e.target.value
                          )
                        }
                        placeholder={field.placeholder ?? undefined}
                        className="pr-9"
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(field.field_name)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {isRevealed ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    {field.help_text && (
                      <p className="text-xs text-muted-foreground">
                        {field.help_text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {fields.length > 0 && !loading && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={testing || !hasExisting}
              onClick={handleTestConnection}
            >
              {testing ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Plug className="mr-1.5 size-3.5" />
              )}
              Test Connection
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                {hasExisting ? "Update Credentials" : "Save Credentials"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
