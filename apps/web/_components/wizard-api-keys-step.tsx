"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { validateApiKey } from "@/_actions/business-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiKeyEntry {
  provider: string;
  key: string;
  required: boolean;
}

export interface ProviderInfo {
  provider: string;
  label: string;
  placeholder: string;
  required: boolean;
  description: string;
}

interface ValidationStatus {
  status: "idle" | "validating" | "valid" | "invalid";
  error?: string;
}

interface Props {
  apiKeys: ApiKeyEntry[];
  onApiKeysChange: (keys: ApiKeyEntry[]) => void;
  requiredProviders?: ProviderInfo[];
}

// ---------------------------------------------------------------------------
// Fallback static providers (used when requiredProviders is not passed)
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDERS: ProviderInfo[] = [
  {
    provider: "anthropic",
    label: "Anthropic",
    placeholder: "sk-ant-...",
    required: true,
    description: "Powers your Sales and Support agents",
  },
  {
    provider: "openai",
    label: "OpenAI",
    placeholder: "sk-...",
    required: false,
    description: "For GPT-4 R&D council member and embeddings",
  },
  {
    provider: "google",
    label: "Google AI",
    placeholder: "AIza...",
    required: false,
    description: "For Gemini R&D council member",
  },
  {
    provider: "mistral",
    label: "Mistral",
    placeholder: "...",
    required: false,
    description: "For Mistral R&D council member",
  },
  {
    provider: "deepseek",
    label: "DeepSeek",
    placeholder: "sk-...",
    required: false,
    description: "Required for R&D Council debates",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardApiKeysStep({
  apiKeys,
  onApiKeysChange,
  requiredProviders,
}: Props) {
  const providers = requiredProviders ?? DEFAULT_PROVIDERS;

  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [validationStatus, setValidationStatus] = useState<
    Record<string, ValidationStatus>
  >({});

  function updateKey(provider: string, value: string) {
    const existing = apiKeys.find((k) => k.provider === provider);
    const providerInfo = providers.find((p) => p.provider === provider);

    // Reset validation status when key changes
    setValidationStatus((prev) => ({
      ...prev,
      [provider]: { status: "idle" },
    }));

    if (existing) {
      onApiKeysChange(
        apiKeys.map((k) => (k.provider === provider ? { ...k, key: value } : k)),
      );
    } else {
      onApiKeysChange([
        ...apiKeys,
        { provider, key: value, required: providerInfo?.required ?? false },
      ]);
    }
  }

  function toggleShow(provider: string) {
    const next = new Set(showKeys);
    if (next.has(provider)) next.delete(provider);
    else next.add(provider);
    setShowKeys(next);
  }

  const validateSingleKey = useCallback(
    async (provider: string, key: string) => {
      if (!key || key.length < 5) return;

      setValidationStatus((prev) => ({
        ...prev,
        [provider]: { status: "validating" },
      }));

      try {
        const result = await validateApiKey(provider, key);
        setValidationStatus((prev) => ({
          ...prev,
          [provider]: result.valid
            ? { status: "valid" }
            : { status: "invalid", error: result.error ?? "Invalid key" },
        }));
      } catch {
        setValidationStatus((prev) => ({
          ...prev,
          [provider]: { status: "invalid", error: "Validation failed" },
        }));
      }
    },
    [],
  );

  /**
   * Validate all non-empty keys in parallel.
   * Called when user clicks "Validate All" or on step advancement.
   */
  const validateAllKeys = useCallback(async () => {
    const nonEmptyKeys = apiKeys.filter((k) => k.key.length >= 5);
    if (nonEmptyKeys.length === 0) return;

    // Mark all as validating
    const validating: Record<string, ValidationStatus> = {};
    for (const k of nonEmptyKeys) {
      validating[k.provider] = { status: "validating" };
    }
    setValidationStatus((prev) => ({ ...prev, ...validating }));

    // Validate in parallel
    const results = await Promise.allSettled(
      nonEmptyKeys.map(async (k) => {
        const result = await validateApiKey(k.provider, k.key);
        return { provider: k.provider, result };
      }),
    );

    const updated: Record<string, ValidationStatus> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        const { provider, result } = r.value;
        updated[provider] = result.valid
          ? { status: "valid" }
          : { status: "invalid", error: result.error ?? "Invalid key" };
      } else {
        // Handle rejection gracefully
      }
    }
    setValidationStatus((prev) => ({ ...prev, ...updated }));
  }, [apiKeys]);

  const anthropicKey = apiKeys.find((k) => k.provider === "anthropic");
  const anthropicValidation = validationStatus["anthropic"];
  const isAnthropicValidated =
    anthropicValidation?.status === "valid";
  const hasAnthropicKey = anthropicKey && anthropicKey.key.length >= 10;

  const anyValidating = Object.values(validationStatus).some(
    (v) => v.status === "validating",
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        API keys are encrypted and stored securely. Only the Anthropic key is
        required. Other keys enable multi-model R&D council features.
      </p>

      <div className="space-y-3">
        {providers.map((provider) => {
          const currentKey =
            apiKeys.find((k) => k.provider === provider.provider)?.key ?? "";
          const isShowing = showKeys.has(provider.provider);
          const status = validationStatus[provider.provider];

          return (
            <div key={provider.provider} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <Label htmlFor={`key-${provider.provider}`} className="font-medium">
                  {provider.label}
                </Label>
                {provider.required ? (
                  <Badge variant="default" className="text-[10px]">Required</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Optional</Badge>
                )}
                {/* Validation status badges */}
                {status?.status === "validating" && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    Validating...
                  </span>
                )}
                {status?.status === "valid" && (
                  <Badge variant="secondary" className="text-[10px] text-green-600">
                    <span className="mr-0.5">&#10003;</span> Valid
                  </Badge>
                )}
                {status?.status === "invalid" && (
                  <Badge variant="secondary" className="text-[10px] text-red-600">
                    <span className="mr-0.5">&#10007;</span>{" "}
                    {status.error ?? "Invalid"}
                  </Badge>
                )}
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                {provider.description}
              </p>
              <div className="flex gap-2">
                <Input
                  id={`key-${provider.provider}`}
                  type={isShowing ? "text" : "password"}
                  placeholder={provider.placeholder}
                  value={currentKey}
                  onChange={(e) => updateKey(provider.provider, e.target.value)}
                  className="font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => toggleShow(provider.provider)}
                  className="shrink-0 rounded-md border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isShowing ? "Hide" : "Show"}
                </button>
                {currentKey.length >= 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={status?.status === "validating"}
                    onClick={() => validateSingleKey(provider.provider, currentKey)}
                    className="shrink-0 text-xs"
                  >
                    Validate
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Validate All button */}
      {apiKeys.filter((k) => k.key.length >= 5).length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={anyValidating}
          onClick={validateAllKeys}
          className="w-full"
        >
          {anyValidating ? "Validating..." : "Validate All Keys"}
        </Button>
      )}

      {/* Warning messages */}
      {!hasAnthropicKey && (
        <p className="text-sm text-amber-600">
          An Anthropic API key is required to deploy agents.
        </p>
      )}
      {hasAnthropicKey && !isAnthropicValidated && anthropicValidation?.status !== "validating" && (
        <p className="text-sm text-amber-600">
          Please validate your Anthropic API key before continuing.
        </p>
      )}
    </div>
  );
}
