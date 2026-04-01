---
phase: 19-rate-limiting-api-cost-tracking
plan: 03
subsystem: dashboard
tags: [recharts, usage-analytics, cost-tracking, dashboard, supabase]

# Dependency graph
requires:
  - phase: 19-01
    provides: api_usage table, model-pricing, budget-service, plan_tier/token_budget columns
provides:
  - Real cost data in Command Center (today/week/month, by provider, by model)
  - Real agent token budgets from COALESCE(agent, template) in RevOps
  - New /businesses/[id]/usage analytics page with Recharts
  - getUsageAnalytics() service function with time-series and breakdown data
  - Sidebar nav entries for RevOps and Usage
affects: [19-04, usage-export, billing]

# Tech tracking
tech-stack:
  added: [recharts@3.8.1]
  patterns: [searchParams-based time filtering, client/server component split for charts]

key-files:
  created:
    - apps/web/app/(dashboard)/businesses/[id]/usage/page.tsx
    - apps/web/_components/usage-charts.tsx
  modified:
    - packages/core/dashboard/dashboard-service.ts
    - packages/core/dashboard/index.ts
    - packages/core/server.ts
    - packages/core/index.ts
    - apps/web/app/(dashboard)/command-center/page.tsx
    - apps/web/app/(dashboard)/businesses/[id]/revops/page.tsx
    - apps/web/_components/sidebar-nav.tsx

key-decisions:
  - "UsageAnalytics type exported from client-safe barrel (types only) for client component imports"
  - "Time filter uses searchParams (server-side URL) not client state, enabling deep-linking to specific periods"
  - "24h period groups by hour, all others group by day for appropriate granularity"
  - "Command Center shows static cost cards (no tabs) -- deep analytics on Usage page"
  - "Flagged agents threshold changed: >80% amber warning, >100% red exceeded (replaces old <50% low-utilization)"

patterns-established:
  - "Recharts client component pattern: server page fetches data, passes to client chart wrapper"
  - "COALESCE budget pattern: agent.token_budget ?? template.token_budget ?? 100000 default"

requirements-completed: [DASH-01, DASH-02]

# Metrics
duration: 11min
completed: 2026-04-01
---

# Phase 19 Plan 03: Dashboard Cost Wiring & Usage Analytics Summary

**Real cost data wired into Command Center and RevOps dashboards, new Usage Analytics page with Recharts time-series charts and multi-dimensional breakdowns**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-01T16:27:31Z
- **Completed:** 2026-04-01T16:38:32Z
- **Tasks:** 5
- **Files modified:** 9

## Accomplishments
- Command Center shows real cost today/week/month with provider and model breakdowns (replaces hardcoded 0)
- RevOps shows real per-agent token budgets from COALESCE(agent, template) with cost column and plan tier badge
- New /businesses/[id]/usage page with Recharts AreaChart, BarChart, and breakdown tables
- Usage page supports 5 time filters (24h, 7d, 30d, MTD, YTD) via searchParams
- Sidebar navigation includes RevOps and Usage links under business sub-nav

## Task Commits

Each task was committed atomically:

1. **Task 1: Install recharts and enhance dashboard-service** - `5d4632d` (feat)
2. **Task 2: Update Command Center page with cost breakdown** - `69c69e3` (feat, bundled with 19-02 commit due to working tree state)
3. **Task 3: Update RevOps page with real budgets and cost data** - `e46a1d8` (feat)
4. **Task 4: Create Usage Analytics page with Recharts** - `bf6bcab` (feat)
5. **Task 5: Update sidebar nav with RevOps and Usage links** - `9ee3d6b` (feat)

## Files Created/Modified
- `packages/core/dashboard/dashboard-service.ts` - Real cost queries for CSuite/RevOps, new getUsageAnalytics()
- `packages/core/dashboard/index.ts` - Barrel exports for getUsageAnalytics and UsageAnalytics type
- `packages/core/server.ts` - Re-export getUsageAnalytics for server components
- `packages/core/index.ts` - Export UsageAnalytics type for client components
- `apps/web/app/(dashboard)/command-center/page.tsx` - Cost Today KPI, cost by period/provider/model cards
- `apps/web/app/(dashboard)/businesses/[id]/revops/page.tsx` - Real budgets, cost column, plan tier badge, flagged agents
- `apps/web/app/(dashboard)/businesses/[id]/usage/page.tsx` - New usage analytics page (server component)
- `apps/web/_components/usage-charts.tsx` - Recharts client component with AreaChart, BarChart, tables
- `apps/web/_components/sidebar-nav.tsx` - RevOps and Usage nav links with TrendingUp and BarChart3 icons

## Decisions Made
- UsageAnalytics type exported from client-safe barrel (types are erased at runtime, no node:crypto risk)
- Time filter uses searchParams URL approach for server-side data fetching and deep-linking
- 24h period groups time series by hour; all other periods group by day
- Command Center kept simple with static cost cards -- no tabs needed since Usage page exists for deep analytics
- Flagged agents logic changed from "low utilization" to budget threshold warnings (>80% amber, >100% red)
- Recharts Tooltip formatter uses Number(value) cast for compatibility with Recharts ValueType

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing type error in deployment-detail.tsx**
- **Found during:** Task 2 (web build)
- **Issue:** `as Deployment` cast failing due to missing `business_id` property on Supabase response shape
- **Fix:** Changed to `as unknown as Deployment` double cast
- **Files modified:** apps/web/_components/deployment-detail.tsx
- **Verification:** Build passes
- **Committed in:** 69c69e3

**2. [Rule 3 - Blocking] Fixed Recharts Tooltip formatter type error**
- **Found during:** Task 4 (web build)
- **Issue:** Recharts Tooltip `formatter` and `labelFormatter` expect `ValueType`, not `number`/`string`
- **Fix:** Removed explicit type annotations, used Number(value) and String(label) casts
- **Files modified:** apps/web/_components/usage-charts.tsx
- **Verification:** Build passes
- **Committed in:** bf6bcab

**3. [Rule 3 - Blocking] Stale .next build cache causing MODULE_NOT_FOUND**
- **Found during:** Task 2 (web build)
- **Issue:** Stale webpack chunk reference `./1771.js` after adding recharts dependency
- **Fix:** Deleted .next directory and rebuilt with --force
- **Verification:** Clean build succeeds

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary for build success. No scope creep.

## Issues Encountered
- Task 2 changes (command-center page) were inadvertently committed alongside a concurrent 19-02 plan commit due to shared working tree state. Changes are correct and in HEAD.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard cost data fully wired from api_usage table
- Usage analytics page ready for production use
- Plan 19-04 can proceed with any remaining rate limiting UI/UX work
- Future: CSV/JSON export from usage page deferred to later phase

## Self-Check: PASSED

All 9 created/modified files verified on disk. All 4 task commits verified in git log.

---
*Phase: 19-rate-limiting-api-cost-tracking*
*Completed: 2026-04-01*
