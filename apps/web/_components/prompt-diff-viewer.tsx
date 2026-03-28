"use client";

interface PromptDiffViewerProps {
  oldText: string;
  newText: string;
}

/**
 * Line-by-line diff display with color highlighting.
 *
 * Compares old and new text line by line:
 * - Removed lines: red background
 * - Added lines: green background
 * - Unchanged lines: normal
 */
export function PromptDiffViewer({ oldText, newText }: PromptDiffViewerProps) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Simple LCS-based diff for line-level changes
  const diff = computeDiff(oldLines, newLines);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 font-mono text-xs">
      {diff.map((entry, i) => {
        if (entry.type === "removed") {
          return (
            <div
              key={i}
              className="rounded-sm bg-red-100 px-2 py-0.5 text-red-900 dark:bg-red-900/30 dark:text-red-300"
            >
              - {entry.text}
            </div>
          );
        }
        if (entry.type === "added") {
          return (
            <div
              key={i}
              className="rounded-sm bg-green-100 px-2 py-0.5 text-green-900 dark:bg-green-900/30 dark:text-green-300"
            >
              + {entry.text}
            </div>
          );
        }
        return (
          <div key={i} className="px-2 py-0.5 text-muted-foreground">
            {"  "}{entry.text}
          </div>
        );
      })}
    </div>
  );
}

interface DiffEntry {
  type: "added" | "removed" | "unchanged";
  text: string;
}

/**
 * Simple diff algorithm comparing two arrays of lines.
 * Uses a Set-based approach for reasonable performance on small texts.
 */
function computeDiff(oldLines: string[], newLines: string[]): DiffEntry[] {
  const result: DiffEntry[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  // Build a simple line-by-line comparison
  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi >= oldLines.length) {
      // Remaining new lines are additions
      result.push({ type: "added", text: newLines[ni] });
      ni++;
    } else if (ni >= newLines.length) {
      // Remaining old lines are removals
      result.push({ type: "removed", text: oldLines[oi] });
      oi++;
    } else if (oldLines[oi] === newLines[ni]) {
      // Lines match
      result.push({ type: "unchanged", text: oldLines[oi] });
      oi++;
      ni++;
    } else {
      // Lines differ - check if old line appears later in new (removal) or vice versa
      const oldInNew = newLines.indexOf(oldLines[oi], ni);
      const newInOld = oldLines.indexOf(newLines[ni], oi);

      if (oldInNew === -1 && newInOld === -1) {
        // Both changed - show as removal + addition
        result.push({ type: "removed", text: oldLines[oi] });
        result.push({ type: "added", text: newLines[ni] });
        oi++;
        ni++;
      } else if (oldInNew !== -1 && (newInOld === -1 || oldInNew - ni <= newInOld - oi)) {
        // Old line found later in new - new lines before it are additions
        while (ni < oldInNew) {
          result.push({ type: "added", text: newLines[ni] });
          ni++;
        }
      } else {
        // New line found later in old - old lines before it are removals
        while (oi < newInOld) {
          result.push({ type: "removed", text: oldLines[oi] });
          oi++;
        }
      }
    }

    // Safety check to prevent infinite loops
    if (oi + ni > maxLen * 3) break;
  }

  return result;
}
