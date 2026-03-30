"use client";

/**
 * Subtle inline department label displayed above lead agent nodes.
 * Not a full-width header bar -- just a minimal text label.
 */
export function AgentTreeDepartment({ name }: { name: string }) {
  return (
    <span className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {name}
    </span>
  );
}
