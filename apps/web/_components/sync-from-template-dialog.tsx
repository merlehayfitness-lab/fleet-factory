"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getTemplateDiffAction,
  syncFromTemplateAction,
} from "@/_actions/agent-actions";
import { getModelFriendlyName } from "@agency-factory/core";

interface SyncFromTemplateDialogProps {
  agentId: string;
  businessId: string;
  hasTemplate: boolean;
}

interface DiffData {
  agent: {
    tool_profile: Record<string, unknown>;
    model_profile: Record<string, unknown>;
  };
  template: {
    tool_profile: Record<string, unknown>;
    model_profile: Record<string, unknown>;
  };
  hasChanges: boolean;
}

/**
 * Sync from Template confirmation dialog with diff preview.
 *
 * Shows side-by-side comparison of agent vs template profiles
 * before overwriting. Disabled when agent has no linked template.
 */
export function SyncFromTemplateDialog({
  agentId,
  businessId,
  hasTemplate,
}: SyncFromTemplateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setLoading(true);
    setError(null);
    setDiff(null);

    const result = await getTemplateDiffAction(agentId, businessId);

    if ("error" in result && result.error) {
      setError(result.error);
      setLoading(false);
      setOpen(true);
      return;
    }

    if ("agent" in result && "template" in result) {
      setDiff(result as DiffData);
    }

    setLoading(false);
    setOpen(true);
  }

  async function handleSync() {
    setSyncing(true);
    const result = await syncFromTemplateAction(agentId, businessId);

    if ("error" in result && result.error) {
      toast.error(result.error);
      setSyncing(false);
      return;
    }

    toast("Profiles synced from template", {
      action: {
        label: "Redeploy",
        onClick: () => router.push(`/businesses/${businessId}/deployments`),
      },
    });
    setSyncing(false);
    setOpen(false);
    router.refresh();
  }

  const agentModelId = (diff?.agent.model_profile as { model?: string })
    ?.model;
  const templateModelId = (diff?.template.model_profile as { model?: string })
    ?.model;
  const modelDiffers =
    JSON.stringify(diff?.agent.model_profile) !==
    JSON.stringify(diff?.template.model_profile);
  const toolsDiffer =
    JSON.stringify(diff?.agent.tool_profile) !==
    JSON.stringify(diff?.template.tool_profile);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={!hasTemplate || loading}
      >
        <RefreshCw className="mr-1.5 size-3.5" />
        {loading ? "Loading..." : "Sync from Template"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sync from Template</DialogTitle>
            <DialogDescription>
              This will overwrite the agent&apos;s model and tool profiles with
              the template&apos;s current values.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {diff && !diff.hasChanges && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-900/10">
              <p className="text-sm text-emerald-800 dark:text-emerald-400">
                Profiles are already in sync with the template. No changes
                needed.
              </p>
            </div>
          )}

          {diff && diff.hasChanges && (
            <div className="space-y-4">
              {modelDiffers && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Model</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-muted p-3">
                      <p className="mb-1 text-xs text-muted-foreground">
                        Current
                      </p>
                      <p className="text-sm">
                        {agentModelId
                          ? getModelFriendlyName(agentModelId)
                          : "Default"}
                      </p>
                    </div>
                    <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/10">
                      <p className="mb-1 text-xs text-blue-700 dark:text-blue-400">
                        Template
                      </p>
                      <p className="text-sm font-medium">
                        {templateModelId
                          ? getModelFriendlyName(templateModelId)
                          : "Default"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {toolsDiffer && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tool Profile</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-muted p-3">
                      <p className="mb-1 text-xs text-muted-foreground">
                        Current
                      </p>
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs">
                        {JSON.stringify(diff.agent.tool_profile, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/10">
                      <p className="mb-1 text-xs text-blue-700 dark:text-blue-400">
                        Template
                      </p>
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs">
                        {JSON.stringify(diff.template.tool_profile, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {diff && !diff.hasChanges ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            ) : diff && diff.hasChanges ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSync} disabled={syncing}>
                  {syncing ? "Syncing..." : "Overwrite Agent Profiles"}
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
