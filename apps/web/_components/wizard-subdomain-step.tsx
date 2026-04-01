"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { checkSubdomainAvailability } from "@/_actions/business-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  slug: string;
  subdomain: string;
  onSubdomainChange: (subdomain: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardSubdomainStep({
  slug,
  subdomain,
  onSubdomainChange,
}: Props) {
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-suggest subdomain from slug
  useEffect(() => {
    if (!manuallyEdited && slug) {
      onSubdomainChange(slug);
    }
  }, [slug, manuallyEdited, onSubdomainChange]);

  // Debounced availability check via real server action
  useEffect(() => {
    if (!subdomain) {
      setAvailable(null);
      setErrorMsg(null);
      return;
    }

    if (subdomain.length < 3) {
      setAvailable(null);
      setErrorMsg(null);
      return;
    }

    setChecking(true);
    setErrorMsg(null);

    const timer = setTimeout(async () => {
      try {
        const result = await checkSubdomainAvailability(subdomain);
        setAvailable(result.available);
        setErrorMsg(result.error ?? null);
      } catch {
        setAvailable(null);
        setErrorMsg("Failed to check availability");
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      setChecking(false);
    };
  }, [subdomain]);

  const fullDomain = subdomain
    ? `${subdomain}.agencyfactory.ai`
    : "your-business.agencyfactory.ai";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose a subdomain for your business owner portal. This will be used by
        your clients to access their dashboard.
      </p>

      <div className="space-y-2">
        <Label htmlFor="subdomain">Subdomain</Label>
        <div className="flex items-center gap-0">
          <Input
            id="subdomain"
            value={subdomain}
            onChange={(e) => {
              setManuallyEdited(true);
              onSubdomainChange(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .slice(0, 63),
              );
            }}
            placeholder="your-business"
            className="rounded-r-none font-mono text-sm"
          />
          <span className="flex h-10 items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground">
            .agencyfactory.ai
          </span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2">
        {checking && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Checking availability...
          </span>
        )}
        {!checking && available === true && subdomain && (
          <Badge variant="secondary" className="text-xs text-green-600">
            <span className="mr-1">&#10003;</span> Available
          </Badge>
        )}
        {!checking && available === false && subdomain && (
          <Badge variant="secondary" className="text-xs text-red-600">
            <span className="mr-1">&#10007;</span>{" "}
            {errorMsg ?? "Taken"}
          </Badge>
        )}
        {!checking && errorMsg && available === null && subdomain && (
          <span className="text-xs text-amber-600">{errorMsg}</span>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground mb-1">Portal URL preview</p>
        <p className="font-mono text-sm">https://{fullDomain}</p>
      </div>
    </div>
  );
}
