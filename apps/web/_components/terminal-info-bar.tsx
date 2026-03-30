"use client";

import { useRouter } from "next/navigation";
import { Terminal as TerminalIcon, X, Circle } from "lucide-react";

interface TerminalInfoBarProps {
  businessId: string;
  businessName: string;
  businessSlug: string;
  vpsStatus: string;
  agentCount: number;
}

/**
 * Info bar above the embedded terminal.
 *
 * Shows VPS status, connected tenant name, agent container count,
 * and a disconnect button that navigates back to the business overview.
 */
export function TerminalInfoBar({
  businessId,
  businessName,
  businessSlug,
  vpsStatus,
  agentCount,
}: TerminalInfoBarProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b border-gray-700 bg-[#0d0d1a] px-4 py-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <TerminalIcon className="size-4" />
          <span className="font-medium">{businessName}</span>
          <span className="text-gray-500">({businessSlug})</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Circle
            className={`size-2 fill-current ${
              vpsStatus === "online"
                ? "text-emerald-400"
                : vpsStatus === "degraded"
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          />
          <span className="text-gray-400">VPS: {vpsStatus}</span>
        </div>
        <div className="text-xs text-gray-500">
          {agentCount} container{agentCount !== 1 ? "s" : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push(`/businesses/${businessId}`)}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
      >
        <X className="size-3.5" />
        Disconnect
      </button>
    </div>
  );
}
