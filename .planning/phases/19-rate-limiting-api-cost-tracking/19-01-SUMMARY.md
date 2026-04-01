---
phase: 19-rate-limiting-api-cost-tracking
plan: 01
subsystem: api
tags: [rate-limiting, budget, pricing, tokens, supabase, concurrency, tiers]

# Dependency graph
requires:
  - phase: 04-task-execution-and-approvals
    provides: "api_usage and api_call_queue tables, metering.ts token estimation"
  - phase: 10-model-config
    provides: "MODEL_PRICING constants in rate-limiter.ts"
provides:
  - "plan_tier column on businesses with trial/starter/pro/enterprise tiers"
  - "monthly_token_limit column on businesses for budget enforcement"
  - "token_budget column on agents for per-agent budget override"
  - "key_source column on api_usage for platform vs business key tracking"
  - "get_plan_limits() SQL function for tier defaults"
  - "model-pricing.ts with 14+ model pricing constants and calculateCost()"
  - "PLAN_LIMITS constants for tier-based concurrency and token limits"
  - "budget-service.ts with checkBudget() and shouldSendBudgetWarning()"
  - "DB-backed rate limiter with slot counting from api_call_queue"
  - "Tier-aware acquireSlot() reading plan_tier from businesses table"
  - "Budget check integration in executeWithRateLimit()"
affects: [19-02, 19-03, 19-04, dashboard, deployment, chat]

# Tech tracking
tech-stack:
  added: []
  patterns: [db-backed-concurrency, tier-aware-rate-limiting, budget-enforcement, best-effort-budget-checks]

key-files:
  created:
    - packages/db/schema/051_plan_tier_and_agent_budget.sql
    - packages/core/rate-limit/model-pricing.ts
    - packages/core/rate-limit/budget-service.ts
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/rate-limit/rate-limiter.ts
    - packages/core/rate-limit/index.ts
    - packages/core/server.ts
    - packages/core/worker/tool-runner.ts

key-decisions:
  - "DB-backed slot counting via COUNT WHERE status=processing instead of in-memory counter"
  - "Per-business stagger tracking kept in-memory (non-critical latency smoothing)"
  - "Budget checks are best-effort: failure allows the API call through"
  - "Agent token_budget uses COALESCE pattern with template fallback via Supabase JOIN"
  - "metering.ts deleted; all usage recording consolidated to logApiUsage in rate-limiter.ts"
  - "usage_records table dropped in favor of api_usage (more detailed, rate-limit aware)"

patterns-established:
  - "Budget check best-effort pattern: DB errors return allowed:true to avoid blocking calls"
  - "Tier-aware config pattern: acquireSlot reads plan_tier for dynamic concurrency limits"
  - "DB-backed slot pattern: insert processing entry to claim slot, update to completed to release"

requirements-completed: [RATE-01, RATE-02, RATE-03, USAGE-02, TIER-01, BUDGET-01, BUDGET-02, BUDGET-03, CLEAN-01]

# Metrics
duration: 6min
completed: 2026-04-01
---

# Phase 19 Plan 01: Rate Limiting Foundation Summary

**DB-backed rate limiter with tier-aware concurrency, budget enforcement service, 14-model pricing constants, and metering cleanup**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-01T16:17:44Z
- **Completed:** 2026-04-01T16:24:09Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments
- Database migration adding plan_tier, monthly_token_limit, token_budget, and key_source columns with get_plan_limits() function
- Extracted model pricing to dedicated constants file with 14+ models across 5 providers
- Refactored rate limiter from in-memory to DB-backed slot counting with tier-aware concurrency
- Created budget enforcement service with 80% amber warning and 100% hard stop
- Deleted legacy metering.ts and usage_records table, consolidated to api_usage + logApiUsage

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration for plan tiers, agent budgets, key_source** - `db646b6` (feat)
2. **Task 2: Extract model pricing and create budget service** - `fed6640` (feat)
3. **Task 3: Refactor rate-limiter.ts for DB-backed slots** - `064d734` (refactor)
4. **Task 4: Delete metering.ts and update tool-runner.ts** - `1523386` (feat)

## Files Created/Modified
- `packages/db/schema/051_plan_tier_and_agent_budget.sql` - Migration adding plan_tier, monthly_token_limit, token_budget, key_source, get_plan_limits(), dropping usage_records
- `packages/db/schema/_combined_schema.sql` - Appended migration 051 content
- `packages/core/rate-limit/model-pricing.ts` - MODEL_PRICING (14 models), PLAN_LIMITS (4 tiers), calculateCost()
- `packages/core/rate-limit/budget-service.ts` - checkBudget() with agent+business level checks, shouldSendBudgetWarning()
- `packages/core/rate-limit/rate-limiter.ts` - DB-backed acquireSlot/releaseSlot, budget checks in executeWithRateLimit, key_source in logApiUsage
- `packages/core/rate-limit/index.ts` - Added exports for model-pricing and budget-service
- `packages/core/server.ts` - Added model-pricing and budget-service exports, removed metering exports
- `packages/core/worker/tool-runner.ts` - Replaced metering imports with logApiUsage/calculateCost, added local estimateTokens

## Decisions Made
- DB-backed slot counting via COUNT WHERE status=processing replaces in-memory activeSlots counter for restart survivability
- Per-business stagger tracking kept in-memory Map (non-critical latency smoothing, doesn't need persistence)
- Budget checks are best-effort: any DB error returns allowed:true to avoid blocking legitimate API calls
- Agent token_budget uses COALESCE pattern with template fallback via Supabase JOIN (cast through unknown for TS compat)
- metering.ts fully deleted; all usage recording consolidated to logApiUsage in rate-limiter.ts
- usage_records table dropped (replaced by api_usage which has richer fields)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed metering exports from server.ts during Task 3**
- **Found during:** Task 3 (rate-limiter refactor)
- **Issue:** Duplicate `calculateCost` identifier -- metering.ts and model-pricing.ts both export it, causing TS2300 error
- **Fix:** Removed metering re-exports from server.ts in Task 3 (planned for Task 4) to unblock compilation
- **Files modified:** packages/core/server.ts
- **Verification:** Core build passes
- **Committed in:** 064d734 (Task 3 commit)

**2. [Rule 1 - Bug] Fixed Supabase JOIN type cast in budget-service.ts**
- **Found during:** Task 2 (budget service creation)
- **Issue:** Supabase belongsTo returns object but TS infers array type for agent_templates JOIN, causing TS2352
- **Fix:** Cast through unknown first: `as unknown as { token_budget: number | null } | null`
- **Files modified:** packages/core/rate-limit/budget-service.ts
- **Verification:** Core build passes
- **Committed in:** fed6640 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. Migration 051 should be applied to the Supabase database.

## Next Phase Readiness
- Rate limiter is DB-backed and tier-aware, ready for integration in Plan 02
- Budget service ready for middleware integration in Plan 02
- Model pricing extracted and available for cost tracking in Plan 03 dashboard
- tool-runner uses logApiUsage, ready for end-to-end flow testing

## Self-Check: PASSED

All 8 created/modified files verified on disk. All 4 task commits found. metering.ts confirmed deleted.

---
*Phase: 19-rate-limiting-api-cost-tracking*
*Completed: 2026-04-01*
