"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AitmplCatalogBrowser } from "@/_components/aitmpl-catalog-browser";

interface AitmplSuggestionBannerProps {
  businessId: string;
  agents: Array<{ id: string; name: string; department_name?: string }>;
  departments: Array<{ id: string; name: string }>;
}

function storageKey(businessId: string) {
  return `aitmpl-banner-dismissed-${businessId}`;
}

export function AitmplSuggestionBanner({
  businessId,
  agents,
  departments,
}: AitmplSuggestionBannerProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash
  const [catalogOpen, setCatalogOpen] = useState(false);
  const hasImportedRef = useRef(false);

  // Read localStorage on mount (client only)
  useEffect(() => {
    const stored = localStorage.getItem(storageKey(businessId));
    setDismissed(stored === "true");
  }, [businessId]);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(storageKey(businessId), "true");
  }

  function handleCatalogOpenChange(open: boolean) {
    setCatalogOpen(open);
    // Auto-dismiss if user imported something during this browse session
    if (!open && hasImportedRef.current) {
      dismiss();
    }
  }

  if (dismissed) return null;

  return (
    <>
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30 p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              Enhance your agents with AITMPL templates
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Browse 1,600+ pre-built skills, agents, commands, and tools from
              the AITMPL community catalog.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => setCatalogOpen(true)}>
              Browse Catalog
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <AitmplCatalogBrowser
        open={catalogOpen}
        onOpenChange={handleCatalogOpenChange}
        businessId={businessId}
        agents={agents}
        departments={departments}
        onImported={() => {
          hasImportedRef.current = true;
        }}
      />
    </>
  );
}
