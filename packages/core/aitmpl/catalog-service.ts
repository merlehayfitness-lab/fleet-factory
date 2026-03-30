/**
 * Server-side AITMPL catalog service with 24h TTL caching.
 *
 * Fetches the full components.json (~10MB+) once and caches in memory.
 * Search/filter functions return lightweight results (no content) safe for clients.
 * Detail lookup returns full content for preview and import.
 */

import type {
  AitmplCatalog,
  AitmplComponent,
  AitmplComponentType,
  CatalogSearchResult,
} from "./catalog-types";
import { DEPARTMENT_CATEGORY_MAP } from "./category-mapping";

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let cachedData: AitmplCatalog | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CATALOG_URL = "https://www.aitmpl.com/components.json";

// ---------------------------------------------------------------------------
// Core catalog fetch
// ---------------------------------------------------------------------------

/**
 * Fetch the full AITMPL catalog with 24h TTL caching.
 * Returns stale cache on fetch failure if available, otherwise throws.
 */
export async function getCatalog(): Promise<AitmplCatalog> {
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  try {
    const res = await fetch(CATALOG_URL);

    if (!res.ok) {
      throw new Error(`AITMPL catalog fetch failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as AitmplCatalog;
    cachedData = data;
    cacheTimestamp = Date.now();
    return data;
  } catch (err) {
    // Return stale cache if available
    if (cachedData) {
      console.error("[aitmpl] Fetch failed, returning stale cache:", err);
      return cachedData;
    }
    throw err;
  }
}

/**
 * Clear the in-memory catalog cache. Useful for development hot-reload.
 */
export function clearCatalogCache(): void {
  cachedData = null;
  cacheTimestamp = 0;
}

// ---------------------------------------------------------------------------
// Search options
// ---------------------------------------------------------------------------

interface SearchOptions {
  type?: AitmplComponentType;
  department?: string;
  limit?: number;
  sort?: "downloads" | "name" | "newest";
}

// ---------------------------------------------------------------------------
// Catalog key mapping
// ---------------------------------------------------------------------------

/** Map component type to catalog array key. */
function getCatalogKey(
  type: AitmplComponentType,
): keyof AitmplCatalog {
  switch (type) {
    case "skill":
      return "skills";
    case "agent":
      return "agents";
    case "command":
      return "commands";
    case "mcp":
      return "mcps";
    case "setting":
      return "settings";
    case "hook":
      return "hooks";
    case "plugin":
      return "plugins";
    default:
      return "skills";
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search AITMPL components server-side. Returns lightweight results (no content).
 *
 * - Filters by query text (name, description, category)
 * - Filters by component type
 * - When department is specified, recommended items appear first
 * - Default sort: downloads descending
 */
export async function searchComponents(
  query: string,
  options?: SearchOptions,
): Promise<CatalogSearchResult[]> {
  const catalog = await getCatalog();
  const lowerQuery = query.toLowerCase().trim();

  // Collect items from the appropriate array(s)
  let items: AitmplComponent[] = [];

  if (options?.type && options.type !== "plugin") {
    const key = getCatalogKey(options.type);
    items = catalog[key] as AitmplComponent[];
  } else if (options?.type === "plugin") {
    // Map plugins to CatalogSearchResult shape
    return catalog.plugins
      .filter((p) => {
        if (!lowerQuery) return true;
        return (
          p.name.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery)
        );
      })
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, options?.limit ?? 50)
      .map((p) => ({
        name: p.name,
        path: p.id,
        category: "plugin",
        type: "plugin",
        description: p.description,
        downloads: p.downloads,
      }));
  } else {
    // Search ALL component arrays (skip plugins and templates for unified search)
    items = [
      ...catalog.skills,
      ...catalog.agents,
      ...catalog.commands,
      ...catalog.mcps,
      ...catalog.settings,
      ...catalog.hooks,
    ];
  }

  // Filter by query text
  let filtered = items.filter((item) => {
    if (!lowerQuery) return true;
    return (
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery)
    );
  });

  // Department-based ordering: recommended items first, then non-matching
  const departmentCategories = options?.department
    ? DEPARTMENT_CATEGORY_MAP[options.department.toLowerCase()] ?? []
    : [];

  if (departmentCategories.length > 0) {
    const recommended = filtered.filter((item) =>
      departmentCategories.includes(item.category),
    );
    const other = filtered.filter(
      (item) => !departmentCategories.includes(item.category),
    );
    filtered = [...recommended, ...other];
  }

  // Sort
  const sortBy = options?.sort ?? "downloads";
  if (sortBy === "downloads") {
    // If department ordering was applied, sort within each group
    if (departmentCategories.length > 0) {
      const recCount = filtered.filter((item) =>
        departmentCategories.includes(item.category),
      ).length;
      const rec = filtered.slice(0, recCount).sort((a, b) => b.downloads - a.downloads);
      const rest = filtered.slice(recCount).sort((a, b) => b.downloads - a.downloads);
      filtered = [...rec, ...rest];
    } else {
      filtered.sort((a, b) => b.downloads - a.downloads);
    }
  } else if (sortBy === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }
  // "newest" -- no date field available, use download order as proxy (already default)

  // Slice to limit
  filtered = filtered.slice(0, options?.limit ?? 50);

  // Map to CatalogSearchResult (strip content)
  return filtered.map(({ name, path, category, type, description, downloads }) => ({
    name,
    path,
    category,
    type,
    description,
    downloads,
  }));
}

// ---------------------------------------------------------------------------
// Detail lookup
// ---------------------------------------------------------------------------

/**
 * Get the full AITMPL component with content for a given path and type.
 * Returns null if not found.
 */
export async function getComponentDetail(
  path: string,
  type: AitmplComponentType,
): Promise<AitmplComponent | null> {
  const catalog = await getCatalog();

  if (type === "plugin") {
    // Plugins have a different shape and live in catalog.plugins
    return null;
  }

  const key = getCatalogKey(type);
  const items = catalog[key] as AitmplComponent[];
  return items.find((item) => item.path === path) ?? null;
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Get components of a given type, sorted by downloads.
 * Shorthand for searchComponents("", { type, limit }).
 */
export async function getComponentsByType(
  type: AitmplComponentType,
  limit?: number,
): Promise<CatalogSearchResult[]> {
  return searchComponents("", { type, limit });
}

/**
 * Get count of items per component type.
 */
export async function getCatalogStats(): Promise<Record<AitmplComponentType, number>> {
  const catalog = await getCatalog();
  return {
    skill: catalog.skills.length,
    agent: catalog.agents.length,
    command: catalog.commands.length,
    mcp: catalog.mcps.length,
    setting: catalog.settings.length,
    hook: catalog.hooks.length,
    plugin: catalog.plugins.length,
  };
}
