"use client";

import type React from "react";

interface ConnectionGroup {
  parentId: string;
  childIds: string[];
}

interface AgentTreeLinesProps {
  nodePositions: Map<string, DOMRect>;
  connectionGroups: ConnectionGroup[];
  containerRect: DOMRect | null;
}

/**
 * SVG elbow/step connector layer for the agent org chart.
 * Draws straight-line connectors: vertical from parent, horizontal bar spanning children,
 * vertical down to each child. Classic org chart style.
 */
export function AgentTreeLines({
  nodePositions,
  connectionGroups,
  containerRect,
}: AgentTreeLinesProps) {
  if (!containerRect || connectionGroups.length === 0) return null;

  const elements: React.JSX.Element[] = [];

  for (const group of connectionGroups) {
    const parentRect = nodePositions.get(group.parentId);
    if (!parentRect) continue;

    // Parent bottom center (relative to container)
    const px = parentRect.left - containerRect.left + parentRect.width / 2;
    const py = parentRect.top - containerRect.top + parentRect.height;

    // Collect child top centers
    const childPoints: { x: number; y: number; id: string }[] = [];
    for (const childId of group.childIds) {
      const childRect = nodePositions.get(childId);
      if (!childRect) continue;
      childPoints.push({
        x: childRect.left - containerRect.left + childRect.width / 2,
        y: childRect.top - containerRect.top,
        id: childId,
      });
    }

    if (childPoints.length === 0) continue;

    // Midpoint Y between parent bottom and first child top
    const midY = py + (childPoints[0].y - py) / 2;

    // 1. Vertical line from parent down to midpoint
    elements.push(
      <line
        key={`v-${group.parentId}`}
        x1={px}
        y1={py}
        x2={px}
        y2={midY}
        stroke="currentColor"
        className="text-border"
        strokeWidth={1.5}
      />,
    );

    if (childPoints.length === 1) {
      // Single child: straight vertical line through midpoint to child
      elements.push(
        <line
          key={`vc-${childPoints[0].id}`}
          x1={childPoints[0].x}
          y1={midY}
          x2={childPoints[0].x}
          y2={childPoints[0].y}
          stroke="currentColor"
          className="text-border"
          strokeWidth={1.5}
        />,
      );

      // If parent center differs from child center, draw horizontal at midpoint
      if (Math.abs(px - childPoints[0].x) > 1) {
        elements.push(
          <line
            key={`h-${group.parentId}`}
            x1={px}
            y1={midY}
            x2={childPoints[0].x}
            y2={midY}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1.5}
          />,
        );
      }
    } else {
      // Multiple children: horizontal bar + verticals to each
      const leftX = Math.min(...childPoints.map((c) => c.x));
      const rightX = Math.max(...childPoints.map((c) => c.x));

      // 2. Horizontal line at midpoint
      elements.push(
        <line
          key={`h-${group.parentId}`}
          x1={leftX}
          y1={midY}
          x2={rightX}
          y2={midY}
          stroke="currentColor"
          className="text-border"
          strokeWidth={1.5}
        />,
      );

      // 3. Vertical lines from horizontal bar down to each child
      for (const child of childPoints) {
        elements.push(
          <line
            key={`vc-${child.id}`}
            x1={child.x}
            y1={midY}
            x2={child.x}
            y2={child.y}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1.5}
          />,
        );
      }
    }
  }

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-0"
      width={containerRect.width}
      height={containerRect.height}
      overflow="visible"
    >
      {elements}
    </svg>
  );
}
