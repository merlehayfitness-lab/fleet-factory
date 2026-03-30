/**
 * JSON file persistence for deployment state.
 *
 * Persists deployment state to JSON files in /data/state/ directory,
 * surviving proxy restarts. Replaces in-memory Map for production use.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { DeploymentState } from "./api-types.js";

const STATE_DIR = process.env.STATE_DIR || "/data/state";

function stateFilePath(deployId: string): string {
  return path.join(STATE_DIR, `deploy-${deployId}.json`);
}

/**
 * Save deployment state to disk as JSON.
 */
export function saveDeploymentState(
  deployId: string,
  state: DeploymentState,
): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFilePath(deployId), JSON.stringify(state, null, 2));
}

/**
 * Load a single deployment state from disk.
 * Returns null if not found.
 */
export function loadDeploymentState(
  deployId: string,
): DeploymentState | null {
  const filePath = stateFilePath(deployId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as DeploymentState;
}

/**
 * Load all deployment states from disk.
 * Returns a Map keyed by deployId.
 */
export function loadAllDeploymentStates(): Map<string, DeploymentState> {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const map = new Map<string, DeploymentState>();

  let entries: string[];
  try {
    entries = fs.readdirSync(STATE_DIR);
  } catch {
    return map;
  }

  for (const entry of entries) {
    if (!entry.startsWith("deploy-") || !entry.endsWith(".json")) {
      continue;
    }
    try {
      const raw = fs.readFileSync(path.join(STATE_DIR, entry), "utf-8");
      const state = JSON.parse(raw) as DeploymentState;
      map.set(state.deployId, state);
    } catch (err) {
      console.warn(`[deploy-state] Failed to parse ${entry}:`, err);
    }
  }

  return map;
}

/**
 * Delete deployment state from disk.
 * Silently ignores missing files.
 */
export function deleteDeploymentState(deployId: string): void {
  const filePath = stateFilePath(deployId);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Silently ignore if file doesn't exist
  }
}
