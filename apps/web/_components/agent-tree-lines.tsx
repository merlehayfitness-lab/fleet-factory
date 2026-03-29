"use client";

interface Connection {
  parentId: string;
  childId: string;
}

interface AgentTreeLinesProps {
  nodePositions: Map<string, DOMRect>;
  connections: Connection[];
  containerRect: DOMRect | null;
}

/**
 * SVG bezier curve connector layer for the agent tree.
 * Draws smooth curves from parent node bottom-center to child node top-center.
 */
export function AgentTreeLines({
  nodePositions,
  connections,
  containerRect,
}: AgentTreeLinesProps) {
  if (!containerRect || connections.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0"
      width={containerRect.width}
      height={containerRect.height}
    >
      {connections.map((conn) => {
        const parentRect = nodePositions.get(conn.parentId);
        const childRect = nodePositions.get(conn.childId);
        if (!parentRect || !childRect) return null;

        // Start: bottom center of parent (relative to container)
        const x1 =
          parentRect.left - containerRect.left + parentRect.width / 2;
        const y1 = parentRect.top - containerRect.top + parentRect.height;

        // End: top center of child (relative to container)
        const x2 =
          childRect.left - containerRect.left + childRect.width / 2;
        const y2 = childRect.top - containerRect.top;

        // Bezier control points for smooth curve
        const verticalOffset = (y2 - y1) * 0.4;
        const cx1 = x1;
        const cy1 = y1 + verticalOffset;
        const cx2 = x2;
        const cy2 = y2 - verticalOffset;

        return (
          <path
            key={`${conn.parentId}-${conn.childId}`}
            d={`M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1.5}
            fill="none"
          />
        );
      })}
    </svg>
  );
}
