"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LayoutGrid, Table as TableIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TasksTable } from "@/_components/tasks-table";
import { TasksKanban } from "@/_components/tasks-kanban";
import { TaskQuickAdd } from "@/_components/task-quick-add";
import { TaskFilters } from "@/_components/task-filters";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  departments: { name: string } | null;
  agents: { name: string } | null;
}

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

interface TasksPageClientProps {
  tasks: Task[];
  departments: Department[];
  agents: Agent[];
  businessId: string;
}

/**
 * Client wrapper for the tasks page.
 * Handles view toggle (table/kanban), client-side filtering, and quick-add.
 */
export function TasksPageClient({
  tasks,
  departments,
  agents,
  businessId,
}: TasksPageClientProps) {
  const [view, setView] = useState<"table" | "kanban">("table");
  const [filters, setFilters] = useState<Filters>({});

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      // Department filter: match by department name since we have the join
      if (
        filters.department &&
        task.departments?.name !==
          departments.find((d) => d.id === filters.department)?.name
      ) {
        return false;
      }
      // Agent filter: match by agent name since we have the join
      if (
        filters.agent &&
        task.agents?.name !==
          agents.find((a) => a.id === filters.agent)?.name
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, filters, departments, agents]);

  return (
    <div className="space-y-4">
      {/* Quick-add form */}
      <TaskQuickAdd departments={departments} businessId={businessId} />

      {/* Filter bar and view toggle */}
      <div className="flex items-center justify-between gap-4">
        <TaskFilters
          departments={departments}
          agents={agents}
          filters={filters}
          onFilterChange={setFilters}
        />

        <div className="flex items-center gap-2">
          <Link
            href={`/businesses/${businessId}/tasks/new`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <Plus className="size-3.5" />
            Full form
          </Link>

          <div className="flex rounded-lg border">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("table")}
              title="Table view"
            >
              <TableIcon className="size-3.5" />
            </Button>
            <Button
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("kanban")}
              title="Kanban view"
            >
              <LayoutGrid className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Task view */}
      {view === "table" ? (
        <TasksTable tasks={filteredTasks} businessId={businessId} />
      ) : (
        <TasksKanban tasks={filteredTasks} businessId={businessId} />
      )}
    </div>
  );
}
