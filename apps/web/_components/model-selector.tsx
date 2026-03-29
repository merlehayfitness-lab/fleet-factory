"use client";

import { useState } from "react";
import {
  CLAUDE_MODELS,
  getModelById,
} from "@agency-factory/core";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelSelectorProps {
  value: string;
  onValueChange: (modelId: string) => void;
  showLegacy?: boolean;
  disabled?: boolean;
}

const TIER_LABELS: Record<string, string> = {
  opus: "Powerful",
  sonnet: "Balanced",
  haiku: "Fast",
};

/**
 * Reusable model selector dropdown.
 *
 * Shows Claude model friendly names, hiding raw API IDs.
 * Filters to latest models by default with optional toggle
 * to reveal legacy models.
 */
export function ModelSelector({
  value,
  onValueChange,
  showLegacy: showLegacyProp = false,
  disabled = false,
}: ModelSelectorProps) {
  const [showAll, setShowAll] = useState(showLegacyProp);

  const models = showAll
    ? CLAUDE_MODELS
    : CLAUDE_MODELS.filter((m) => m.isLatest);

  // Group by tier
  const tiers = ["opus", "sonnet", "haiku"] as const;
  const grouped = tiers
    .map((tier) => ({
      tier,
      label: TIER_LABELS[tier],
      models: models.filter((m) => m.tier === tier),
    }))
    .filter((g) => g.models.length > 0);

  const current = getModelById(value);

  return (
    <div className="space-y-1.5">
      <Select
        value={value}
        onValueChange={(val: string | null) => {
          if (val) onValueChange(val);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select model">
            {current?.friendlyName ?? "Select model"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {grouped.map((group, gi) => (
            <SelectGroup key={group.tier}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.friendlyName}
                </SelectItem>
              ))}
              {gi < grouped.length - 1 && <SelectSeparator />}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
          className="rounded"
        />
        Show all models
      </label>
    </div>
  );
}
