"use client";

import { useState, useMemo } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

interface CredentialFormProps {
  fields: CredentialField[];
  existingSecrets: Secret[];
  onSave: (values: Record<string, string>) => Promise<void>;
  isSaving: boolean;
  /** Map of field_name -> revealed plaintext from eye toggle */
  revealedValues?: Record<string, string>;
}

/**
 * Dynamic credential form driven by provider field definitions.
 *
 * Renders one input per field, ordered by field_order.
 * Tracks which fields have been modified to only send changes on save.
 */
export function CredentialForm({
  fields,
  existingSecrets,
  onSave,
  isSaving,
  revealedValues = {},
}: CredentialFormProps) {
  // Map existing secrets by key for quick lookup
  const secretsByKey = useMemo(() => {
    const map = new Map<string, Secret>();
    for (const s of existingSecrets) {
      map.set(s.key, s);
    }
    return map;
  }, [existingSecrets]);

  const isEditing = existingSecrets.length > 0;
  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.field_order - b.field_order),
    [fields],
  );

  // Local form values -- only populated when user modifies a field
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

  function handleFieldChange(fieldName: string, value: string) {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
    setModifiedFields((prev) => {
      const next = new Set(prev);
      next.add(fieldName);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isEditing) {
      // Only send modified fields
      const changedValues: Record<string, string> = {};
      for (const fieldName of modifiedFields) {
        const value = formValues[fieldName];
        if (value !== undefined && value.trim() !== "") {
          changedValues[fieldName] = value.trim();
        }
      }
      if (Object.keys(changedValues).length === 0) return;
      await onSave(changedValues);
    } else {
      // Send all field values for new entry
      const allValues: Record<string, string> = {};
      for (const field of sortedFields) {
        const value = formValues[field.field_name]?.trim();
        if (value) {
          allValues[field.field_name] = value;
        }
      }
      await onSave(allValues);
    }

    // Reset modification tracking after save
    setModifiedFields(new Set());
    setFormValues({});
  }

  const hasChanges = modifiedFields.size > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {sortedFields.map((field) => {
        const existingSecret = secretsByKey.get(field.field_name);
        const revealedValue = revealedValues[field.field_name];
        const localValue = formValues[field.field_name];
        const isModified = modifiedFields.has(field.field_name);

        // Determine displayed value
        const displayValue = isModified
          ? (localValue ?? "")
          : revealedValue
            ? revealedValue
            : "";

        const placeholderText = existingSecret
          ? (revealedValue ? "" : "********")
          : (field.placeholder ?? `Enter ${field.display_label.toLowerCase()}`);

        // Determine input type
        const inputType =
          field.field_type === "password" && !revealedValue
            ? "password"
            : field.field_type === "url"
              ? "url"
              : "text";

        return (
          <div key={field.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`field-${field.field_name}`} className="text-sm">
                {field.display_label}
              </Label>
              {existingSecret && (
                <span className="text-xs text-muted-foreground">
                  Updated{" "}
                  {new Date(existingSecret.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <Input
              id={`field-${field.field_name}`}
              type={inputType}
              placeholder={placeholderText}
              value={displayValue}
              onChange={(e) =>
                handleFieldChange(field.field_name, e.target.value)
              }
              required={!isEditing}
            />
            {field.help_text && (
              <p className="text-xs text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        );
      })}

      <Button
        type="submit"
        size="sm"
        disabled={isSaving || (isEditing && !hasChanges)}
        className="gap-1.5"
      >
        {isSaving ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Save className="size-3.5" />
        )}
        {isEditing ? "Save Changes" : "Save Credentials"}
      </Button>
    </form>
  );
}
