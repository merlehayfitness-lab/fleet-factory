"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getSkillUsageAction } from "@/_actions/skill-actions";
import type { SkillUsage } from "@fleet-factory/core";

interface SkillUsageCardProps {
  skillId: string;
  businessId: string;
}

/**
 * Skill usage statistics card.
 * Shows "Used by N agents, N departments" with expandable list of names.
 */
export function SkillUsageCard({ skillId }: SkillUsageCardProps) {
  const [usage, setUsage] = useState<SkillUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchUsage() {
      setLoading(true);
      const result = await getSkillUsageAction(skillId);

      if (cancelled) return;

      if ("usage" in result) {
        setUsage(result.usage);
      }
      setLoading(false);
    }

    fetchUsage();
    return () => {
      cancelled = true;
    };
  }, [skillId]);

  if (loading) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 animate-pulse">
        <div className="h-4 w-48 rounded bg-muted" />
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const totalCount = usage.agent_count + usage.department_count;

  if (totalCount === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          Not assigned to any agents or departments
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        <span>
          Used by {usage.agent_count}{" "}
          {usage.agent_count === 1 ? "agent" : "agents"},{" "}
          {usage.department_count}{" "}
          {usage.department_count === 1 ? "department" : "departments"}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-5">
          {usage.agents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Agents
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {usage.agents.map((agent) => (
                  <li key={agent.id} className="text-xs">
                    {agent.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {usage.departments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Departments
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {usage.departments.map((dept) => (
                  <li key={dept.id} className="text-xs">
                    {dept.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
