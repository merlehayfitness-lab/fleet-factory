---
phase: 05-observability-and-command-center
plan: 01
subsystem: database, ui, api
tags: [supabase, rls, health-metrics, polling, collapsible, audit-logs, conversations, messages]

# Dependency graph
requires:
  - phase: 04-task-execution-and-approvals
    provides: tasks, approvals, assistance_requests, usage_records tables and services
provides:
  - conversations and messages schema with RLS policies
  - health service with agent status, error rate, task throughput, recent activity aggregation
  - HealthDashboard client component with 30s auto-refresh polling
  - AgentHealthGrid with 5-state status badges and expandable cards
  - Chat and Logs sidebar nav links enabled
affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [health-service aggregation pattern, polling-based client refresh, collapsible agent cards]

key-files:
  created:
    - packages/db/schema/024_conversations_table.sql
    - packages/db/schema/025_messages_table.sql
    - packages/db/schema/026_phase5_rls_policies.sql
    - packages/core/health/health-service.ts
    - apps/web/_actions/health-actions.ts
    - apps/web/_components/health-dashboard.tsx
    - apps/web/_components/agent-health-grid.tsx
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/types/index.ts
    - packages/core/index.ts
    - packages/core/server.ts
    - apps/web/app/(dashboard)/businesses/[id]/page.tsx
    - apps/web/_components/sidebar-nav.tsx

key-decisions:
  - "Health service uses parallel Promise.all for all aggregation queries (performance optimization)"
  - "HealthDashboard replaces BusinessOverview as the primary business page component"
  - "Agent health grid uses Collapsible from shadcn/ui (base-ui) for expandable card detail"
  - "Usage summary kept as separate component, embedded within health dashboard layout"

patterns-established:
  - "Health aggregation pattern: service accepts SupabaseClient, returns typed payload, parallel queries"
  - "Polling refresh pattern: Server Action for data fetch, setInterval in client component, useState for data"

requirements-completed: [TOPS-01, TOPS-02]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 05 Plan 01: Health Dashboard & Schema Summary

**Conversations/messages schema with RLS, health metrics service aggregating agent status/errors/throughput, and enhanced business dashboard with auto-refresh polling and department-grouped agent grid**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T19:30:26Z
- **Completed:** 2026-03-26T19:35:29Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Conversations and messages tables with full RLS policies following existing patterns, plus performance indexes for health dashboard queries
- Health service computing agent status by department, error rates, task throughput, and recent activity -- all scoped by business_id with parallel query execution
- Business overview page upgraded from static counts to full health dashboard with agent grid, error rate indicator, task throughput metrics, and real audit_logs in recent activity
- Dashboard auto-refreshes health data every 30 seconds via Server Action polling
- Sidebar nav enables Logs link and adds Chat link with MessageSquare icon

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migrations for conversations, messages, and Phase 5 indexes** - `c2fac91` (feat)
2. **Task 2: Health service, Server Actions, enhanced dashboard, agent grid, nav updates** - `5922299` (feat)

## Files Created/Modified
- `packages/db/schema/024_conversations_table.sql` - Conversations table with status CHECK, 3 indexes, 3 RLS policies
- `packages/db/schema/025_messages_table.sql` - Messages table with role CHECK, 2 indexes, 2 RLS policies (immutable)
- `packages/db/schema/026_phase5_rls_policies.sql` - Performance indexes on agents, tasks, audit_logs for health queries
- `packages/db/schema/_combined_schema.sql` - Appended all Phase 5 migrations
- `packages/core/types/index.ts` - Added ConversationStatus and MessageRole types
- `packages/core/index.ts` - Added ConversationStatus and MessageRole type exports
- `packages/core/server.ts` - Added health service exports
- `packages/core/health/health-service.ts` - Health metrics aggregation with 5 exported functions
- `apps/web/_actions/health-actions.ts` - Server Action for polling health data
- `apps/web/_components/health-dashboard.tsx` - Client component with auto-refresh, stats cards, quick links, activity timeline
- `apps/web/_components/agent-health-grid.tsx` - Agent grid grouped by department with 5-state badges and Collapsible expansion
- `apps/web/app/(dashboard)/businesses/[id]/page.tsx` - Refactored to use getSystemHealth and HealthDashboard
- `apps/web/_components/sidebar-nav.tsx` - Enabled Logs, added Chat link with MessageSquare icon

## Decisions Made
- Health service uses `Promise.all` for parallel query execution to minimize dashboard load time
- HealthDashboard replaces BusinessOverview as the primary component -- BusinessOverview file is kept but no longer imported
- Agent health grid uses Collapsible from shadcn/ui (base-ui) for expandable card detail without asChild
- Usage summary kept as a separate component embedded within the health dashboard layout rather than merging
- Error rate color coding: green < 5%, amber 5-20%, red > 20%

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

Database migration required: Run the contents of `024_conversations_table.sql`, `025_messages_table.sql`, and `026_phase5_rls_policies.sql` in the Supabase SQL Editor.

## Next Phase Readiness
- Conversations and messages schema ready for 05-03 (Agent Chat Interface)
- Health dashboard provides the observability foundation for 05-02 (Audit Log Viewer)
- Sidebar nav has both Logs and Chat links enabled and pointing to correct routes

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (c2fac91, 5922299) verified in git log.

---
*Phase: 05-observability-and-command-center*
*Completed: 2026-03-26*
