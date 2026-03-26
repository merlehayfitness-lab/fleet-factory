"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/_actions/log-actions";

interface AuditLogTableProps {
  logs: AuditLogEntry[];
}

type SortKey = "createdAt" | "action" | "entityType" | "entityId" | "actorId";
type SortDir = "asc" | "desc";

/** Humanize action string */
function humanizeAction(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format timestamp for table display */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Sortable data table view for audit logs.
 * Compact rows for scanning large volumes. Client-side sort on loaded data.
 */
export function AuditLogTable({ logs }: AuditLogTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sortedLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [logs, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No audit log entries found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortableHeader
              label="Timestamp"
              active={sortKey === "createdAt"}
              dir={sortDir}
              onClick={() => toggleSort("createdAt")}
            />
          </TableHead>
          <TableHead>
            <SortableHeader
              label="Action"
              active={sortKey === "action"}
              dir={sortDir}
              onClick={() => toggleSort("action")}
            />
          </TableHead>
          <TableHead>
            <SortableHeader
              label="Entity Type"
              active={sortKey === "entityType"}
              dir={sortDir}
              onClick={() => toggleSort("entityType")}
            />
          </TableHead>
          <TableHead>
            <SortableHeader
              label="Entity ID"
              active={sortKey === "entityId"}
              dir={sortDir}
              onClick={() => toggleSort("entityId")}
            />
          </TableHead>
          <TableHead>
            <SortableHeader
              label="Actor"
              active={sortKey === "actorId"}
              dir={sortDir}
              onClick={() => toggleSort("actorId")}
            />
          </TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedLogs.map((entry) => (
          <LogRow
            key={entry.id}
            entry={entry}
            expanded={expandedRow === entry.id}
            onToggle={() =>
              setExpandedRow(expandedRow === entry.id ? null : entry.id)
            }
          />
        ))}
      </TableBody>
    </Table>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown
        className={cn(
          "size-3",
          active ? "text-foreground" : "text-muted-foreground/50",
        )}
      />
      {active && (
        <span className="text-[10px] text-muted-foreground">
          {dir === "asc" ? "asc" : "desc"}
        </span>
      )}
    </button>
  );
}

function LogRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <>
      <TableRow className="text-xs">
        <TableCell className="font-mono text-[11px]">
          {formatTimestamp(entry.createdAt)}
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {humanizeAction(entry.action)}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {entry.entityType ?? "-"}
        </TableCell>
        <TableCell className="font-mono text-[11px] text-muted-foreground">
          {entry.entityId ? entry.entityId.slice(0, 8) + "..." : "-"}
        </TableCell>
        <TableCell className="font-mono text-[11px] text-muted-foreground">
          {entry.actorId ? entry.actorId.slice(0, 8) + "..." : "-"}
        </TableCell>
        <TableCell>
          {hasMetadata && (
            <button
              type="button"
              onClick={onToggle}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          )}
        </TableCell>
      </TableRow>
      {expanded && hasMetadata && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-3">
            <div className="text-[11px] font-mono space-y-0.5">
              {Object.entries(entry.metadata).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">{key}:</span>
                  <span className="break-all">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
