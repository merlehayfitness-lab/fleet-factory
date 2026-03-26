"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  LayoutList,
  Table2,
  Download,
  Search,
  X,
  Radio,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AuditLogTimeline } from "@/_components/audit-log-timeline";
import { AuditLogTable } from "@/_components/audit-log-table";
import {
  getAuditLogs,
  exportAuditLogs,
  type AuditLogEntry,
  type AuditLogFilters,
} from "@/_actions/log-actions";

interface AuditLogViewerProps {
  businessId: string;
  initialLogs: AuditLogEntry[];
}

const ENTITY_TYPES = ["agent", "business", "deployment", "task", "approval", "integration"];

/**
 * Audit log viewer with timeline/table toggle, advanced filters,
 * live tail mode, and CSV/JSON export.
 */
export function AuditLogViewer({
  businessId,
  initialLogs,
}: AuditLogViewerProps) {
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [totalCount, setTotalCount] = useState(initialLogs.length);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveTail, setIsLiveTail] = useState(false);
  const liveTailRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const buildFilters = useCallback((): AuditLogFilters => {
    const filters: AuditLogFilters = { limit: 50, offset: 0 };
    if (search) filters.search = search;
    if (eventType) filters.eventType = eventType;
    if (entityType) filters.entityType = entityType;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    return filters;
  }, [search, eventType, entityType, dateFrom, dateTo]);

  const fetchLogs = useCallback(
    async (filters: AuditLogFilters) => {
      setIsLoading(true);
      const result = await getAuditLogs(businessId, filters);
      if ("logs" in result) {
        setLogs(result.logs);
        setTotalCount(result.totalCount);
      }
      setIsLoading(false);
    },
    [businessId],
  );

  // Fetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(buildFilters());
    }, 300); // debounce
    return () => clearTimeout(timer);
  }, [search, eventType, entityType, dateFrom, dateTo, fetchLogs, buildFilters]);

  // Live tail mode: poll every 5 seconds
  useEffect(() => {
    if (isLiveTail) {
      liveTailRef.current = setInterval(async () => {
        const filters = buildFilters();
        const result = await getAuditLogs(businessId, filters);
        if ("logs" in result) {
          setLogs(result.logs);
          setTotalCount(result.totalCount);
        }
      }, 5_000);
    } else {
      if (liveTailRef.current) {
        clearInterval(liveTailRef.current);
        liveTailRef.current = null;
      }
    }

    return () => {
      if (liveTailRef.current) {
        clearInterval(liveTailRef.current);
      }
    };
  }, [isLiveTail, businessId, buildFilters]);

  // Load more (offset-based pagination)
  const handleLoadMore = useCallback(async () => {
    setIsLoading(true);
    const filters = buildFilters();
    filters.offset = logs.length;
    const result = await getAuditLogs(businessId, filters);
    if ("logs" in result) {
      setLogs((prev) => [...prev, ...result.logs]);
      setTotalCount(result.totalCount);
    }
    setIsLoading(false);
  }, [businessId, logs.length, buildFilters]);

  // Export
  const handleExport = useCallback(
    async (format: "csv" | "json") => {
      const filters = buildFilters();
      const result = await exportAuditLogs(businessId, filters);
      if (!("data" in result)) return;

      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === "json") {
        content = JSON.stringify(result.data, null, 2);
        mimeType = "application/json";
        extension = "json";
      } else {
        const headers = [
          "ID",
          "Action",
          "Entity Type",
          "Entity ID",
          "Actor ID",
          "Created At",
          "Metadata",
        ];
        const rows = result.data.map((log) => [
          log.id,
          log.action,
          log.entityType ?? "",
          log.entityId ?? "",
          log.actorId ?? "",
          log.createdAt,
          JSON.stringify(log.metadata),
        ]);
        content = [
          headers.join(","),
          ...rows.map((r) =>
            r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
          ),
        ].join("\n");
        mimeType = "text/csv";
        extension = "csv";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [businessId, buildFilters],
  );

  const clearFilters = () => {
    setSearch("");
    setEventType("");
    setEntityType("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = search || eventType || entityType || dateFrom || dateTo;
  const hasMoreLogs = logs.length < totalCount;

  return (
    <div className="space-y-4">
      {/* Toolbar: View toggle, live tail, export */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors rounded-l-lg",
                viewMode === "timeline"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <LayoutList className="size-3.5" />
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors rounded-r-lg",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <Table2 className="size-3.5" />
              Table
            </button>
          </div>

          {/* Live tail toggle */}
          <Button
            variant={isLiveTail ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLiveTail(!isLiveTail)}
            className="gap-1 text-xs"
          >
            <Radio
              className={cn("size-3.5", isLiveTail && "animate-pulse")}
            />
            Live
          </Button>

          {isLiveTail && (
            <Badge variant="secondary" className="text-[10px] animate-pulse">
              Polling every 5s
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            className="gap-1 text-xs"
          >
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            className="gap-1 text-xs"
          >
            <Download className="size-3.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search actions and metadata..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <div className="min-w-[120px]">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          >
            <option value="">All events</option>
            <option value="emergency">Emergency</option>
            <option value="agent">Agent</option>
            <option value="task">Task</option>
            <option value="deployment">Deployment</option>
            <option value="approval">Approval</option>
            <option value="business">Business</option>
          </select>
        </div>

        <div className="min-w-[120px]">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 text-xs w-[130px]"
            placeholder="From"
          />
        </div>

        <div>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 text-xs w-[130px]"
            placeholder="To"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-xs text-muted-foreground"
          >
            <X className="size-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {logs.length} of {totalCount} entries
        </span>
        {isLoading && (
          <Loader2 className="size-3.5 animate-spin" />
        )}
      </div>

      {/* Log view */}
      {viewMode === "timeline" ? (
        <AuditLogTimeline logs={logs} />
      ) : (
        <AuditLogTable logs={logs} />
      )}

      {/* Load more */}
      {hasMoreLogs && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoading}
            className="text-xs"
          >
            {isLoading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
