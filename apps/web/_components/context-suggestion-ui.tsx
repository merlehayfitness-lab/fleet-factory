"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KnowledgeDoc {
  id: string;
  title: string;
}

interface Integration {
  id: string;
  name: string;
  type: string;
}

interface ContextSuggestionUIProps {
  knowledgeDocs: KnowledgeDoc[];
  integrations: Integration[];
  onSelectionChange: (docTitles: string[], integrationNames: string[]) => void;
}

/**
 * Checkbox panel for selecting knowledge docs and integrations to include
 * in prompt generation context.
 *
 * All items are pre-checked by default. Admin unchecks what they don't want.
 */
export function ContextSuggestionUI({
  knowledgeDocs,
  integrations,
  onSelectionChange,
}: ContextSuggestionUIProps) {
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(
    new Set(knowledgeDocs.map((d) => d.id)),
  );
  const [selectedIntegrations, setSelectedIntegrations] = useState<Set<string>>(
    new Set(integrations.map((i) => i.id)),
  );

  useEffect(() => {
    const docTitles = knowledgeDocs
      .filter((d) => selectedDocs.has(d.id))
      .map((d) => d.title);
    const intNames = integrations
      .filter((i) => selectedIntegrations.has(i.id))
      .map((i) => `${i.name} (${i.type})`);
    onSelectionChange(docTitles, intNames);
  }, [selectedDocs, selectedIntegrations, knowledgeDocs, integrations, onSelectionChange]);

  function toggleDoc(id: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleIntegration(id: string) {
    setSelectedIntegrations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const hasDocs = knowledgeDocs.length > 0;
  const hasIntegrations = integrations.length > 0;
  const totalItems = knowledgeDocs.length + integrations.length;
  const totalSelected = selectedDocs.size + selectedIntegrations.size;
  const allSelected = totalSelected === totalItems;

  function toggleAll() {
    if (allSelected) {
      setSelectedDocs(new Set());
      setSelectedIntegrations(new Set());
    } else {
      setSelectedDocs(new Set(knowledgeDocs.map((d) => d.id)));
      setSelectedIntegrations(new Set(integrations.map((i) => i.id)));
    }
  }

  if (!hasDocs && !hasIntegrations) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Context for Generation</CardTitle>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Knowledge Documents */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Knowledge Documents
          </Label>
          {hasDocs ? (
            <div className="space-y-1">
              {knowledgeDocs.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocs.has(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    className="rounded border-muted-foreground/25"
                  />
                  <span className="text-muted-foreground">{doc.title}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No knowledge documents available
            </p>
          )}
        </div>

        {/* Integrations */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Integrations</Label>
          {hasIntegrations ? (
            <div className="space-y-1">
              {integrations.map((int) => (
                <label
                  key={int.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIntegrations.has(int.id)}
                    onChange={() => toggleIntegration(int.id)}
                    className="rounded border-muted-foreground/25"
                  />
                  <span className="text-muted-foreground">
                    {int.name}{" "}
                    <span className="text-xs opacity-60">({int.type})</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No integrations configured
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
