"use client";

import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { restoreTenantAction } from "@/_actions/emergency-actions";
import { useRouter } from "next/navigation";

interface SuspendedBannerProps {
  businessId: string;
  businessName: string;
  status: string;
}

export function SuspendedBanner({
  businessId,
  businessName,
  status,
}: SuspendedBannerProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = status === "suspended" ? "suspended" : "disabled";

  async function handleRestore() {
    setIsRestoring(true);
    setError(null);
    try {
      const result = await restoreTenantAction(businessId);
      if ("error" in result) {
        setError(result.error);
        setIsRestoring(false);
      } else {
        router.refresh();
      }
    } catch {
      setError("Failed to restore business.");
      setIsRestoring(false);
    }
  }

  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
      <ShieldAlert className="h-5 w-5 shrink-0" />
      <p className="text-sm">
        <strong>{businessName}</strong> is {statusLabel}. The dashboard is in
        read-only mode. No deployments, tasks, or changes can be made until
        restored.
      </p>

      <div className="ml-auto flex items-center gap-2">
        {error && <span className="text-xs text-red-600">{error}</span>}

        {showConfirm ? (
          <>
            <span className="text-xs font-medium">Are you sure?</span>
            <button
              onClick={handleRestore}
              disabled={isRestoring}
              className="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {isRestoring ? "Restoring..." : "Confirm"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isRestoring}
              className="rounded border border-red-300 px-3 py-1 text-xs font-medium hover:bg-red-100 disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-900/50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
          >
            Restore
          </button>
        )}
      </div>
    </div>
  );
}
