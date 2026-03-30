"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ExternalLink, Unlink, Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  connectSlackAction,
  getSlackStatusAction,
  disconnectSlackAction,
} from "@/_actions/slack-actions";
import type { SlackConnectionStatus } from "@agency-factory/core";

interface SlackConnectCardProps {
  businessId: string;
  initialStatus: SlackConnectionStatus;
}

/**
 * Slack connection card for the integrations page.
 * Primary OAuth entry point per user decision.
 *
 * When not connected: shows Connect Slack button that opens OAuth popup.
 * When connected: shows workspace info, channel count, disconnect button.
 */
export function SlackConnectCard({
  businessId,
  initialStatus,
}: SlackConnectCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SlackConnectionStatus>(initialStatus);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = status.connected;

  // Fetch channel count when connected
  useEffect(() => {
    if (!isConnected) {
      setChannelCount(null);
      return;
    }

    async function fetchChannelCount() {
      const { getSlackChannelsAction } = await import(
        "@/_actions/slack-actions"
      );
      const result = await getSlackChannelsAction(businessId);
      if ("channels" in result) {
        setChannelCount(result.channels.length);
      }
    }

    void fetchChannelCount();
  }, [isConnected, businessId]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);

    const result = await connectSlackAction(businessId);
    if ("error" in result) {
      setIsConnecting(false);
      return;
    }

    // Open OAuth popup centered on screen
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      result.url,
      "slack-oauth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`,
    );

    // Poll for successful connection every 2 seconds for up to 30 seconds
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 2000;

      const statusResult = await getSlackStatusAction(businessId);
      if ("status" in statusResult && statusResult.status.connected) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setStatus(statusResult.status);
        setIsConnecting(false);
        router.refresh();
        return;
      }

      if (elapsed >= 30000) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setIsConnecting(false);
      }
    }, 2000);
  }, [businessId, router]);

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm("Disconnect Slack? This will remove all channel mappings and Slack credentials for this business.")) {
      return;
    }

    setIsDisconnecting(true);
    const result = await disconnectSlackAction(businessId);

    if ("success" in result) {
      setStatus({ connected: false });
      setChannelCount(null);
    }

    setIsDisconnecting(false);
    router.refresh();
  }, [businessId, router]);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Slack icon */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950/40">
            <MessageSquare className="size-5 text-purple-600 dark:text-purple-400" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Slack</h3>
              {isConnected ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                >
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  Not connected
                </Badge>
              )}
            </div>

            {isConnected && status.connected ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Workspace: <span className="font-medium text-foreground">{status.teamName ?? "Unknown"}</span>
                </p>
                {channelCount !== null && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Hash className="size-3" />
                    {channelCount} channel{channelCount !== 1 ? "s" : ""} mapped
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Connect your Slack workspace to route messages between department agents and Slack channels
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-2">
        {isConnected && status.connected ? (
          <>
            <a
              href={`https://slack.com/app_redirect?team=${status.teamId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink className="mr-1 size-3" />
              Open Slack Workspace
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/businesses/${businessId}/chat`)}
            >
              <Hash className="mr-1.5 size-3" />
              Manage Channels
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-destructive hover:text-destructive"
            >
              {isDisconnecting ? (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              ) : (
                <Unlink className="mr-1.5 size-3" />
              )}
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="mr-1.5 size-3 animate-spin" />
            ) : (
              <MessageSquare className="mr-1.5 size-3" />
            )}
            {isConnecting ? "Connecting..." : "Connect Slack"}
          </Button>
        )}
      </div>
    </div>
  );
}
