---
phase: 15-aitmpl-template-catalog
plan: 01
subsystem: api
tags: [aitmpl, catalog, import, caching, typescript]

# Dependency graph
requires:
  - phase: 09-skill-management-deployment
    provides: "Skill CRUD, assignment, and compilation services"
provides:
  - "AitmplComponent/AitmplPlugin/AitmplTemplate type definitions"
  - "DEPARTMENT_CATEGORY_MAP for recommendation logic"
  - "Catalog service with 24h TTL server-side caching"
  - "searchComponents() with query/type/department filtering"
  - "getComponentDetail() for full content retrieval"
  - "importFromAitmpl() converting AITMPL types to Fleet Factory entities"
affects: [15-02, 15-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Module-level TTL cache for external API", "Server-side catalog filtering with lightweight client results"]

key-files:
  created:
    - packages/core/aitmpl/catalog-types.ts
    - packages/core/aitmpl/category-mapping.ts
    - packages/core/aitmpl/catalog-service.ts
    - packages/core/aitmpl/import-service.ts
  modified:
    - packages/core/index.ts
    - packages/core/server.ts

key-decisions:
  - "Removed Next.js-specific fetch revalidate option from catalog-service since packages/core uses Node.js types -- 24h TTL handled by module-level cache instead"
  - "Plugin type returns decomposition error listing constituent paths rather than auto-importing parts"
  - "Department filtering puts recommended items first rather than excluding non-matching items"

patterns-established:
  - "AITMPL imports use source_type 'imported' and source_url 'aitmpl://{type}/{path}' for traceability"
  - "Server-side catalog filtering returns CatalogSearchResult[] without content field to avoid 10MB+ client payload"

requirements-completed: [AITMPL-01, AITMPL-02, AITMPL-03, AITMPL-04]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 15 Plan 01: AITMPL Catalog Service Summary

**AITMPL catalog service with 24h TTL caching, department-based search/filter, and import service converting skills/agents/MCPs into Fleet Factory entities**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T16:31:45Z
- **Completed:** 2026-03-30T16:35:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- TypeScript type definitions matching the public AITMPL JSON schema (AitmplComponent, AitmplPlugin, AitmplTemplate, AitmplCatalog)
- Static department-to-category mapping for all 4 department types (owner, sales, support, operations)
- Server-side catalog service with 24h TTL module-level cache and stale-cache fallback on fetch failure
- Search with query text, type, and department filtering returning lightweight CatalogSearchResult[] (no content)
- Import service handling all 7 AITMPL types: skill/command/setting/hook as skills, agent as system_prompt, mcp as tool_profile merge, plugin as decomposition error

## Task Commits

Each task was committed atomically:

1. **Task 1: AITMPL type definitions and category mapping** - `c7eebb0` (feat)
2. **Task 2: Catalog service, import service, and barrel exports** - `7320786` (feat)

## Files Created/Modified
- `packages/core/aitmpl/catalog-types.ts` - TypeScript interfaces for AITMPL component, plugin, template, catalog, search result, and import types
- `packages/core/aitmpl/category-mapping.ts` - Static DEPARTMENT_CATEGORY_MAP with getRecommendedCategories() and isDepartmentRecommended() helpers
- `packages/core/aitmpl/catalog-service.ts` - getCatalog(), searchComponents(), getComponentDetail(), getComponentsByType(), getCatalogStats(), clearCatalogCache()
- `packages/core/aitmpl/import-service.ts` - importFromAitmpl() with type-specific routing for all 7 AITMPL component types
- `packages/core/index.ts` - Added client-safe AITMPL type and category mapping exports
- `packages/core/server.ts` - Added server-only catalog service and import service exports

## Decisions Made
- Removed `next: { revalidate: 86400 }` from fetch call since packages/core uses Node.js types (not Next.js). The 24h TTL is already handled by module-level cache variables.
- Plugin import returns decomposition error with constituent part paths rather than auto-importing. This gives the UI actionable guidance for the user.
- Department filtering puts recommended items first (sorted by downloads within each group) rather than excluding non-matching items entirely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed Next.js-specific fetch revalidate option**
- **Found during:** Task 2 (catalog-service.ts)
- **Issue:** `{ next: { revalidate: 86400 } }` is a Next.js extension to RequestInit. The packages/core tsconfig uses Node.js types where this property does not exist, causing TS2769.
- **Fix:** Removed the `next` option from fetch call. The 24h TTL is already enforced by the module-level `cachedData` / `cacheTimestamp` variables.
- **Files modified:** packages/core/aitmpl/catalog-service.ts
- **Verification:** `pnpm turbo typecheck` passes across all packages (5/5)
- **Committed in:** 7320786 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- removed a redundant caching hint that conflicted with Node.js types. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All AITMPL backend services ready for UI consumption in Plan 02 (catalog browser dialog)
- Types, search, and import all exported through established barrel pattern
- No blockers

## Self-Check: PASSED

All 4 created files verified on disk. Both task commits (c7eebb0, 7320786) verified in git log.

---
*Phase: 15-aitmpl-template-catalog*
*Completed: 2026-03-30*
