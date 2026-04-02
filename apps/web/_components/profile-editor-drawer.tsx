"use client";

import { useState, useEffect } from "react";
import type { ToolProfileShape } from "@fleet-factory/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { ToolProfileForm } from "./tool-profile-form";

interface ProfileEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  profile: ToolProfileShape;
  onSave: (updated: ToolProfileShape) => void;
  businessId: string;
}

/**
 * Fixed-position side panel (drawer) for editing tool/model profiles.
 *
 * Supports structured form view and raw JSON editor view with
 * bidirectional toggle. Follows the task-detail-panel.tsx pattern.
 */
export function ProfileEditorDrawer({
  isOpen,
  onClose,
  title,
  profile,
  onSave,
  businessId,
}: ProfileEditorDrawerProps) {
  const [viewMode, setViewMode] = useState<"form" | "json">("form");
  const [formProfile, setFormProfile] = useState<ToolProfileShape>(profile);
  const [jsonText, setJsonText] = useState(JSON.stringify(profile, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset state when drawer opens with new profile
  useEffect(() => {
    if (isOpen) {
      setFormProfile(profile);
      setJsonText(JSON.stringify(profile, null, 2));
      setJsonError(null);
      setViewMode("form");
    }
  }, [isOpen, profile]);

  function switchToJson() {
    // Form -> JSON: serialize current form state
    setJsonText(JSON.stringify(formProfile, null, 2));
    setJsonError(null);
    setViewMode("json");
  }

  function switchToForm() {
    // JSON -> Form: validate first
    try {
      const parsed = JSON.parse(jsonText) as ToolProfileShape;
      // Basic shape validation
      if (!parsed || typeof parsed !== "object") {
        setJsonError("Invalid profile structure");
        return;
      }
      setFormProfile({
        allowed_tools: Array.isArray(parsed.allowed_tools) ? parsed.allowed_tools : ["*"],
        mcp_servers: Array.isArray(parsed.mcp_servers) ? parsed.mcp_servers : [],
      });
      setJsonError(null);
      setViewMode("form");
    } catch (err) {
      setJsonError(
        err instanceof Error ? err.message : "Invalid JSON",
      );
    }
  }

  function handleSave() {
    setSaving(true);
    try {
      if (viewMode === "json") {
        // Validate and parse JSON first
        const parsed = JSON.parse(jsonText) as ToolProfileShape;
        onSave({
          allowed_tools: Array.isArray(parsed.allowed_tools) ? parsed.allowed_tools : ["*"],
          mcp_servers: Array.isArray(parsed.mcp_servers) ? parsed.mcp_servers : [],
        });
      } else {
        onSave(formProfile);
      }
      onClose();
    } catch (err) {
      setJsonError(
        err instanceof Error ? err.message : "Invalid JSON",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-xs"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative z-10 flex w-full max-w-xl flex-col bg-popover shadow-lg ring-1 ring-foreground/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-md border">
              <button
                className={`px-2.5 py-1 text-xs font-medium ${
                  viewMode === "form"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                }`}
                onClick={() =>
                  viewMode === "json" ? switchToForm() : undefined
                }
              >
                Form
              </button>
              <button
                className={`px-2.5 py-1 text-xs font-medium ${
                  viewMode === "json"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                }`}
                onClick={() =>
                  viewMode === "form" ? switchToJson() : undefined
                }
              >
                JSON
              </button>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4">
          {viewMode === "form" ? (
            <ToolProfileForm
              profile={formProfile}
              onChange={setFormProfile}
              businessId={businessId}
            />
          ) : (
            <div className="space-y-2">
              <Textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                className="min-h-64 font-mono text-sm"
              />
              {jsonError && (
                <p className="text-sm text-destructive">{jsonError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
