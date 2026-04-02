/**
 * Port allocation registry for per-agent Docker containers.
 *
 * Persists a JSON map of vpsAgentId -> hostPort at /data/state/port-registry.json.
 * Loaded on proxy startup to restore port assignments across restarts.
 *
 * Port range: 19001+ (avoids conflicts with OpenClaw default 18789 and proxy 3100).
 */

import * as fs from "node:fs";
import * as path from "node:path";

const STATE_DIR = process.env.STATE_DIR || "/data/state";
const REGISTRY_FILE = path.join(STATE_DIR, "port-registry.json");
const PORT_RANGE_START = 19001;
const PORT_RANGE_END = 19999;

interface PortEntry {
  port: number;
  businessSlug: string;
  allocatedAt: string;
}

type PortRegistry = Record<string, PortEntry>;

let registry: PortRegistry = {};

/**
 * Load port registry from disk. Call once on startup.
 */
export function loadPortRegistry(): void {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const raw = fs.readFileSync(REGISTRY_FILE, "utf-8");
      registry = JSON.parse(raw) as PortRegistry;
      console.log(`[port-registry] Loaded ${Object.keys(registry).length} port allocations`);
    }
  } catch (err) {
    console.warn("[port-registry] Failed to load registry, starting fresh:", err);
    registry = {};
  }
}

/**
 * Save port registry to disk.
 */
function saveRegistry(): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

/**
 * Allocate a host port for an agent container.
 * If the agent already has a port, returns the existing allocation.
 */
export function allocatePort(vpsAgentId: string, businessSlug: string): number {
  // Return existing allocation if present
  if (registry[vpsAgentId]) {
    return registry[vpsAgentId].port;
  }

  // Find next available port
  const usedPorts = new Set(Object.values(registry).map((e) => e.port));
  let port = PORT_RANGE_START;
  while (usedPorts.has(port) && port <= PORT_RANGE_END) {
    port++;
  }

  if (port > PORT_RANGE_END) {
    throw new Error(`Port exhaustion: no available ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`);
  }

  registry[vpsAgentId] = {
    port,
    businessSlug,
    allocatedAt: new Date().toISOString(),
  };
  saveRegistry();

  console.log(`[port-registry] Allocated port ${port} for ${vpsAgentId}`);
  return port;
}

/**
 * Get the allocated port for an agent. Returns undefined if not allocated.
 */
export function getPort(vpsAgentId: string): number | undefined {
  return registry[vpsAgentId]?.port;
}

/**
 * Release all port allocations for a business.
 * Call before redeploying or when removing a tenant.
 */
export function releaseBusinessPorts(businessSlug: string): number {
  let released = 0;
  for (const [agentId, entry] of Object.entries(registry)) {
    if (entry.businessSlug === businessSlug) {
      delete registry[agentId];
      released++;
    }
  }
  if (released > 0) {
    saveRegistry();
    console.log(`[port-registry] Released ${released} ports for tenant ${businessSlug}`);
  }
  return released;
}

/**
 * Release a single agent's port allocation.
 */
export function releasePort(vpsAgentId: string): void {
  if (registry[vpsAgentId]) {
    const port = registry[vpsAgentId].port;
    delete registry[vpsAgentId];
    saveRegistry();
    console.log(`[port-registry] Released port ${port} for ${vpsAgentId}`);
  }
}

/**
 * Get all port allocations (for health checks, debugging).
 */
export function getAllPorts(): Record<string, PortEntry> {
  return { ...registry };
}

/**
 * Get all port allocations for a specific business.
 */
export function getBusinessPorts(businessSlug: string): Array<{ vpsAgentId: string; port: number }> {
  return Object.entries(registry)
    .filter(([, entry]) => entry.businessSlug === businessSlug)
    .map(([agentId, entry]) => ({ vpsAgentId: agentId, port: entry.port }));
}
