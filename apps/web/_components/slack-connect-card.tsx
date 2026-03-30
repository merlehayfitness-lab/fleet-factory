"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ExternalLink, Unlink, Hash, Loader2, AlertCircle, X, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  connectSlackAction,
  getSlackStatusAction,
  disconnectSlackAction,
  saveSlackAppCredentialsAction,
} from "@/_actions/slack-actions";
import type { SlackConnectionStatus } from "@agency-factory/core";

interface SlackConnectCardProps {
  businessId: string;
  initialStatus: SlackConnectionStatus;
}

export function SlackConnectCard({
  businessId,
  initialStatus,
}: SlackConnectCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SlackConnectionStatus>(initialStatus);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [setupClientId, setSetupClientId] = useState("");
  const [setupClientSecret, setSetupClientSecret] = useState("");
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = status.connected;

  useEffect(() => {
    if (!isConnected) {
      setChannelCount(null);
      return;
    }
    async function fetchChannelCount() {
      const { getSlackChannelsAction } = await import("@/_actions/slack-actions");
      const result = await getSlackChannelsAction(businessId);
      if ("channels" in result) {
        setChannelCount(result.channels.length);
      }
    }
    void fetchChannelCount();
  }, [isConnected, businessId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const startOAuthFlow = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    const result = await connectSlackAction(businessId);
    if ("error" in result) {
      if ("code" in result && result.code === "SLACK_APP_NOT_CONFIGURED") {
        setShowSetup(true);
      } else {
        setError(result.error);
      }
      setIsConnecting(false);
      return;
    }

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      result.url,
      "slack-oauth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`,
    );

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

  const handleSaveSetup = useCallback(async () => {
    setIsSavingSetup(true);
    setError(null);

    const result = await saveSlackAppCredentialsAction(
      businessId,
      setupClientId,
      setupClientSecret,
    );

    if ("error" in result) {
      setError(result.error);
      setIsSavingSetup(false);
      return;
    }

    setIsSavingSetup(false);
    setShowSetup(false);
    setSetupClientId("");
    setSetupClientSecret("");

    // Now retry the OAuth flow with saved credentials
    await startOAuthFlow();
  }, [businessId, setupClientId, setupClientSecret, startOAuthFlow]);

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
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
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
          <>
            <Button
              size="sm"
              onClick={startOAuthFlow}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              ) : (
                <MessageSquare className="mr-1.5 size-3" />
              )}
              {isConnecting ? "Connecting..." : "Connect Slack"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowSetup(true); setError(null); }}
              className="text-muted-foreground"
            >
              <KeyRound className="mr-1.5 size-3" />
              Update Credentials
            </Button>
          </>
        )}
      </div>

      {/* Setup dialog — shown when Slack app credentials aren't configured */}
      {showSetup && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Slack App Setup</h4>
            </div>
            <button
              onClick={() => { setShowSetup(false); setError(null); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="text-xs text-muted-foreground mb-3 space-y-2">
            <p>
              Enter your Slack app credentials. Get these from{" "}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                api.slack.com
              </a>
              {" "}&rarr; Your App &rarr; <strong>Basic Information</strong>.
            </p>
            <p>
              Also add this <strong>Redirect URL</strong> in your Slack app under OAuth &amp; Permissions:
            </p>
            <code className="block rounded bg-muted px-2 py-1 text-[11px] font-mono select-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/slack/oauth/callback
            </code>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="slack-client-id" className="block text-xs font-medium mb-1">
                Client ID
              </label>
              <input
                id="slack-client-id"
                type="text"
                value={setupClientId}
                onChange={(e) => setSetupClientId(e.target.value)}
                placeholder="e.g. 1234567890.1234567890"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="slack-client-secret" className="block text-xs font-medium mb-1">
                Client Secret
              </label>
              <input
                id="slack-client-secret"
                type="password"
                value={setupClientSecret}
                onChange={(e) => setSetupClientSecret(e.target.value)}
                placeholder="Enter your client secret"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSaveSetup}
                disabled={isSavingSetup || !setupClientId.trim() || !setupClientSecret.trim()}
              >
                {isSavingSetup ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : (
                  <KeyRound className="mr-1.5 size-3" />
                )}
                {isSavingSetup ? "Saving..." : "Save & Connect"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowSetup(false); setError(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && !showSetup && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{error}</p>
        </div>
      )}

      {error && showSetup && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
