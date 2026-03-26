"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
}

interface Filters {
  status?: string;
  department?: string;
  priority?: string;
  agent?: string;
}

interface TaskFiltersProps {
  departments: Department[];
  agents: Agent[];
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}

const TASK_STATUSES = [
  { value: "queued", label: "Queued" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_approval", label: "Waiting Approval" },
  { value: "assistance_requested", label: "Assistance Requested" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
] as const;

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

/**
 * Filter bar for tasks page.
 * Provides status, department, priority, and agent filter dropdowns.
 */
export function TaskFilters({
  departments,
  agents,
  filters,
  onFilterChange,
}: TaskFiltersProps) {
  const hasFilters = Object.values(filters).some(Boolean);

  function updateFilter(key: keyof Filters, value: string | undefined) {
    onFilterChange({ ...filters, [key]: value });
  }

  function clearFilters() {
    onFilterChange({});
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.status ?? ""}
        onValueChange={(val) => updateFilter("status", val || undefined)}
      >
        <SelectTrigger size="sm" className="w-[150px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          {TASK_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.department ?? ""}
        onValueChange={(val) => updateFilter("department", val || undefined)}
      >
        <SelectTrigger size="sm" className="w-[150px]">
          <span className="flex flex-1 text-left truncate">
            {departments.find((d) => d.id === filters.department)?.name ?? "All departments"}
          </span>
        </SelectTrigger>
        <SelectContent>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority ?? ""}
        onValueChange={(val) => updateFilter("priority", val || undefined)}
      >
        <SelectTrigger size="sm" className="w-[120px]">
          <SelectValue placeholder="All priorities" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.agent ?? ""}
        onValueChange={(val) => updateFilter("agent", val || undefined)}
      >
        <SelectTrigger size="sm" className="w-[150px]">
          <span className="flex flex-1 text-left truncate">
            {agents.find((a) => a.id === filters.agent)?.name ?? "All agents"}
          </span>
        </SelectTrigger>
        <SelectContent>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 size-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
