"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchAitmplAction,
  getAitmplDetailAction,
  importAitmplAction,
} from "@/_actions/aitmpl-actions";
import { AitmplTargetPicker } from "@/_components/aitmpl-target-picker";
import type { AitmplComponentType, CatalogSearchResult } from "@agency-factory/core";
import { isDepartmentRecommended } from "@agency-factory/core";

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: { value: AitmplComponentType; label: string }[] = [
  { value: "skill", label: "Skills" },
  { value: "agent", label: "Agents" },
  { value: "command", label: "Commands" },
  { value: "mcp", label: "MCPs" },
  { value: "setting", label: "Settings" },
  { value: "hook", label: "Hooks" },
  { value: "plugin", label: "Plugins" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AitmplCatalogBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  defaultType?: AitmplComponentType;
  departmentType?: string;
  agentId?: string;
  agents: Array<{ id: string; name: string; department_name?: string }>;
  departments: Array<{ id: string; name: string }>;
  onImported?: () => void;
}

// ---------------------------------------------------------------------------
// Component detail shape
// ---------------------------------------------------------------------------

interface ComponentDetail {
  name: string;
  path: string;
  category: string;
  type: string;
  content: string;
  description: string;
  downloads: number;
}

// ---------------------------------------------------------------------------
// Catalog Browser
// ---------------------------------------------------------------------------

export function AitmplCatalogBrowser({
  open,
  onOpenChange,
  businessId,
  defaultType,
  departmentType,
  agentId,
  agents,
  departments,
  onImported,
}: AitmplCatalogBrowserProps) {
  // State
  const [activeTab, setActiveTab] = useState<AitmplComponentType>(
    defaultType ?? "skill",
  );
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"downloads" | "name">("downloads");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mcpPreview, setMcpPreview] = useState<Record<string, unknown> | null>(null);
  const [showMcpConfirm, setShowMcpConfirm] = useState(false);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract unique categories from results
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const r of results) cats.add(r.category);
    return ["All", ...Array.from(cats).sort()];
  }, [results]);

  // Filter by category client-side
  const filteredResults = useMemo(() => {
    if (categoryFilter === "All") return results;
    return results.filter((r) => r.category === categoryFilter);
  }, [results, categoryFilter]);

  // Search function
  const doSearch = useCallback(
    async (q: string, tab: AitmplComponentType, sort: "downloads" | "name") => {
      setLoading(true);
      setError(null);
      const limit = q.length > 0 ? 50 : 10;
      const res = await searchAitmplAction(q, {
        type: tab,
        department: departmentType,
        limit,
        sort,
      });
      if ("error" in res) {
        setError(res.error);
        setResults([]);
      } else {
        setResults(res.results);
      }
      setLoading(false);
    },
    [departmentType],
  );

  // Trigger search on open, tab change, sort change
  useEffect(() => {
    if (!open) return;
    doSearch(query, activeTab, sortBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, sortBy]);

  // Debounced search on query change
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, activeTab, sortBy);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Reset state on tab change
  function handleTabChange(tab: AitmplComponentType) {
    setActiveTab(tab);
    setCategoryFilter("All");
    setSelectedComponent(null);
    setShowMcpConfirm(false);
    setMcpPreview(null);
  }

  // Handle Add click
  async function handleAdd(item: CatalogSearchResult) {
    setDetailLoading(true);
    const res = await getAitmplDetailAction(
      item.path,
      item.type as AitmplComponentType,
    );
    setDetailLoading(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setSelectedComponent(res.component);
    setShowMcpConfirm(false);
    setMcpPreview(null);
  }

  // Handle Import click
  function handleImportClick() {
    if (!selectedComponent) return;

    if (selectedComponent.type === "mcp") {
      try {
        const parsed = JSON.parse(selectedComponent.content) as Record<string, unknown>;
        setMcpPreview(parsed);
        setShowMcpConfirm(true);
      } catch {
        toast.error("Failed to parse MCP content as JSON");
      }
      return;
    }
    setShowTargetPicker(true);
  }

  // Handle target confirm
  async function handleTargetConfirm(target: {
    agentId?: string;
    departmentId?: string;
  }) {
    if (!selectedComponent) return;

    setImporting(true);
    const result = await importAitmplAction({
      businessId,
      componentPath: selectedComponent.path,
      componentType: selectedComponent.type as AitmplComponentType,
      targetAgentId: target.agentId,
      targetDepartmentId: target.departmentId,
    });

    setImporting(false);
    setShowTargetPicker(false);
    setShowMcpConfirm(false);
    setMcpPreview(null);

    if (result.success) {
      toast.success(`Imported "${result.name}" successfully`);
      setSelectedComponent(null);
      onImported?.();
    } else {
      toast.error(result.error ?? "Import failed");
    }
  }

  // Format download count
  function formatDownloads(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k installs`;
    return `${n} installs`;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AITMPL Template Catalog</DialogTitle>
            <DialogDescription>
              Browse 1,600+ pre-built skills, agents, commands, and tools from
              the AITMPL community catalog.
            </DialogDescription>
          </DialogHeader>

          {/* Tab bar */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <Button
                key={tab.value}
                size="sm"
                variant={activeTab === tab.value ? "default" : "outline"}
                onClick={() => handleTabChange(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder={`Search ${TABS.find((t) => t.value === activeTab)?.label ?? ""}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={categoryFilter}
              onValueChange={(v) => v && setCategoryFilter(v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "All" ? "All Categories" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(v) => v && setSortBy(v as "downloads" | "name")}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="downloads">Most Popular</SelectItem>
                <SelectItem value="name">A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center gap-3">
              <p className="text-sm text-muted-foreground">
                Failed to load catalog
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => doSearch(query, activeTab, sortBy)}
              >
                <RefreshCw className="mr-1 size-3.5" />
                Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredResults.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No results found
              </p>
            </div>
          )}

          {/* Card grid */}
          {!loading && !error && filteredResults.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredResults.map((item) => {
                const isRecommended =
                  departmentType &&
                  isDepartmentRecommended(departmentType, item.category);

                return (
                  <div
                    key={item.path}
                    className="flex flex-col rounded-lg border p-4"
                  >
                    <h4 className="font-semibold text-sm">{item.name}</h4>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {formatDownloads(item.downloads)}
                      </Badge>
                      {isRecommended && (
                        <Badge className="text-xs bg-emerald-600 hover:bg-emerald-700">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <div className="mt-auto pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={detailLoading}
                        onClick={() => handleAdd(item)}
                      >
                        {detailLoading ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <Plus className="mr-1 size-3.5" />
                        )}
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Detail panel */}
          {selectedComponent && (
            <div className="mt-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">
                  {selectedComponent.name}
                </h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedComponent(null);
                    setShowMcpConfirm(false);
                    setMcpPreview(null);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {selectedComponent.description}
              </p>
              <pre className="max-h-[300px] overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {selectedComponent.content}
              </pre>

              {/* MCP confirmation section */}
              {showMcpConfirm && mcpPreview ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    The following MCP server will be added to the agent&apos;s
                    tool profile:
                  </p>
                  <pre className="max-h-[200px] overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(mcpPreview, null, 2)}
                  </pre>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setShowTargetPicker(true)}
                      disabled={importing}
                    >
                      {importing ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : null}
                      Confirm &amp; Select Agent
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowMcpConfirm(false);
                        setMcpPreview(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={handleImportClick}
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : null}
                    Import
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Target picker */}
      <AitmplTargetPicker
        open={showTargetPicker}
        onOpenChange={setShowTargetPicker}
        businessId={businessId}
        agents={agents}
        departments={departments}
        componentName={selectedComponent?.name ?? ""}
        componentType={selectedComponent?.type ?? "skill"}
        preselectedAgentId={agentId}
        onConfirm={handleTargetConfirm}
      />
    </>
  );
}
