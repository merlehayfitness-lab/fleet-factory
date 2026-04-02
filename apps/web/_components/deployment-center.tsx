"use client";

import { useState, useEffect } from "react";
import { DeploymentList } from "@/_components/deployment-list";
import { DeploymentDetail } from "@/_components/deployment-detail";
import { useBusinessStatus } from "@/_components/business-status-provider";

interface Deployment {
  id: string;
  business_id: string;
  version: number;
  status: string;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  config_snapshot: Record<string, unknown> | null;
}

interface DeploymentCenterProps {
  deployments: Deployment[];
  businessId: string;
  vpsWsUrl: string | null;
  vpsConfigured: boolean;
  activeDeploymentId: string | null;
}

/**
 * Client wrapper managing selected deployment state.
 * Renders split-view with deployment list (left) and detail (right).
 */
export function DeploymentCenter({
  deployments,
  businessId,
  vpsWsUrl,
  vpsConfigured,
  activeDeploymentId,
}: DeploymentCenterProps) {
  const { isDisabled } = useBusinessStatus();
  const [selectedId, setSelectedId] = useState<string | null>(
    deployments[0]?.id ?? null
  );

  // When deployments list changes (e.g. after a new deploy), auto-select newest
  useEffect(() => {
    const newest = deployments[0]?.id ?? null;
    if (newest && newest !== selectedId) {
      setSelectedId(newest);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployments[0]?.id]);

  const selectedDeployment =
    deployments.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Left panel: deployment history list */}
      <div className="w-full shrink-0 lg:w-64">
        <DeploymentList
          deployments={deployments}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Right panel: selected deployment details */}
      <div className="min-h-[400px] min-w-0 max-w-3xl flex-1 rounded-lg border p-4">
        <DeploymentDetail
          deployment={selectedDeployment}
          businessId={businessId}
          vpsWsUrl={selectedDeployment?.id === activeDeploymentId ? vpsWsUrl : null}
          vpsConfigured={vpsConfigured}
          isDisabled={isDisabled}
        />
      </div>
    </div>
  );
}
