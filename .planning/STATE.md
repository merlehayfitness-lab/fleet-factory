# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** One-click tenant provisioning that creates an isolated business workspace with department agents, deployment pipeline, and a command center to manage it all.
**Current focus:** Phase 6 in progress -- Builder & Automation

## Current Position

Phase: 6 of 6 (Builder & Automation)
Plan: 1 of 4 in current phase (1 complete)
Status: Executing Phase 6
Last activity: 2026-03-27 -- Completed 06-01 (VPS Foundations)

Progress: [████████████████████] 80% (20/25 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 20
- Average duration: 6min
- Total execution time: 1.9 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | 23min | 6min |
| 02 | 2 | 15min | 8min |
| 03 | 5 | 26min | 5min |
| 04 | 5 | 29min | 6min |
| 05 | 3 | 21min | 7min |
| 06 | 1 | 9min | 9min |

**Recent Trend:**
- Last 5 plans: 04-05 (3min), 05-01 (5min), 05-02 (9min), 05-03 (7min), 06-01 (9min)
- Trend: stable

*Updated after each plan completion*
| Phase 01 P01 | 5min | 2 tasks | 29 files |
| Phase 01 P02 | 5min | 2 tasks | 22 files |
| Phase 01 P03 | 8min | 2 tasks | 14 files |
| Phase 01 P04 | 5min | 2 tasks | 14 files |
| Phase 02 P01 | 9min | 2 tasks | 23 files |
| Phase 02 P02 | 6min | 2 tasks | 12 files |
| Phase 03 P01 | 4min | 2 tasks | 23 files |
| Phase 03 P02 | 8min | 2 tasks | 10 files |
| Phase 03 P03 | 7min | 2 tasks | 18 files |
| Phase 03 P04 | 4min | 2 tasks | 11 files |
| Phase 03 P05 | 3min | 2 tasks | 3 files |
| Phase 04 P01 | 7min | 2 tasks | 15 files |
| Phase 04 P02 | 4min | 2 tasks | 10 files |
| Phase 04 P03 | 9min | 2 tasks | 30 files |
| Phase 04 P04 | 6min | 2 tasks | 9 files |
| Phase 04 P05 | 3min | 2 tasks | 1 files |
| Phase 05 P01 | 5min | 2 tasks | 14 files |
| Phase 05 P02 | 9min | 2 tasks | 14 files |
| Phase 05 P03 | 7min | 2 tasks | 13 files |
| Phase 06 P01 | 9min | 3 tasks | 22 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 6-phase delivery order driven by strict dependency chains (research-validated)
- [Roadmap]: Phase 1 must establish RLS and atomic provisioning before any other work (pitfall prevention)
- [Roadmap]: TOPS-04 (usage metering) placed in Phase 4 alongside agent execution, not Phase 5 observability
- [01-01]: Manual monorepo scaffold (no create-turbo) for full control over structure
- [01-01]: Tailwind CSS v4 with CSS-only config -- no tailwind.config.ts
- [01-01]: Biome for lint/format instead of ESLint+Prettier
- [01-01]: RLS helpers use (SELECT auth.uid()) for query plan caching
- [01-01]: Audit log INSERT gated by is_business_member() to prevent cross-tenant log injection
- [01-02]: Environment variables accessed via helper functions that throw on missing values
- [01-02]: Middleware redirects authenticated users away from auth pages to /businesses
- [01-02]: Sign-out action in separate 'use server' file for clean Server Action isolation
- [01-02]: shadcn/ui initialized with Tailwind v4 defaults (OKLCH colors, tw-animate-css, data-slot pattern)
- [01-03]: Removed Zod .default() to avoid input/output type mismatch with react-hook-form; default via form defaultValues
- [01-03]: Thin Server Action pattern: createBusiness under 20 lines, delegates to core + RPC
- [01-03]: Multi-step wizard with local state (useState) for step navigation
- [01-03]: Slug auto-generation from name with manual override via slugManuallyEdited flag
- [01-04]: Used buttonVariants() for Link styling instead of asChild -- base-ui Button does not support asChild prop
- [01-04]: Business sub-nav extracted from pathname via regex match for dynamic route detection
- [01-04]: Disabled nav links rendered as span elements with cursor-not-allowed and reduced opacity
- [01-04]: signOut invoked from client via async wrapper function calling the server action directly
- [02-01]: Added dom lib to packages/core tsconfig for console.error support in service layer
- [02-01]: Agent audit logging is best-effort (errors logged not thrown) to avoid failing core operations
- [02-01]: Templates are global but routed under business path for navigation consistency
- [02-01]: Added Toaster from sonner to root layout for toast notification support
- [02-02]: Controlled AlertDialog pattern for freeze/retire dialogs triggered from kebab menus
- [02-02]: Template diff uses JSON.stringify comparison with side-by-side amber-highlighted display
- [02-02]: Activity timeline computes relative times client-side to avoid hydration mismatches
- [03-01]: Added @types/node to packages/core for Node.js crypto module support
- [03-01]: Pure function generators with string output for maximum testability and portability
- [03-01]: Docker compose YAML built via template literals (no yaml library) for zero dependencies
- [03-01]: Frozen and retired agents excluded from docker-compose generation
- [03-02]: Split @agency-factory/core barrel into index.ts (client-safe) and server.ts (Node.js-dependent) to fix node:crypto build failure
- [03-02]: Removed unused @agency-factory/core dependency from runtime to eliminate circular workspace dependency
- [03-02]: Deployment service returns full record on both success and failure for consistent API
- [03-02]: Secrets decryption errors handled gracefully with empty array fallback for dev without ENCRYPTION_KEY
- [03-03]: CollapsibleTrigger used directly without asChild -- base-ui Collapsible does not support asChild
- [03-03]: Select onValueChange wrapped with null guard for base-ui compatibility (value can be string | null)
- [03-03]: Secrets never decrypted client-side -- reveal shows confirmation text only, decryption server-side during deployment
- [03-03]: Deployment center uses client wrapper component for selected deployment state across list and detail panels
- [03-04]: Server Actions call Supabase directly for integrations CRUD instead of delegating through core service
- [03-04]: Real provider options shown in dropdown but display coming-soon message -- no credential forms for MVP
- [03-04]: Business-wide integrations overview is read-only; editing happens only on agent detail Integrations tab
- [03-04]: Integration config card shows max 3 capability badges with +N more overflow
- [03-05]: UNIQUE index added as CREATE UNIQUE INDEX IF NOT EXISTS for idempotent migration safety
- [03-05]: router.refresh() added alongside revalidatePath for immediate client-side UI update after mutations
- [04-01]: Zod v4 requires z.record(z.string(), z.unknown()) and z.nullable(schema) standalone form
- [04-01]: Webhook endpoint uses service_role client (SECR-05 exception for external system auth)
- [04-01]: High priority tasks return decomposition preview -- admin must confirm before subtask creation
- [04-01]: Task manager role (owner/admin/manager) can create/update tasks; only owner/admin can delete
- [04-01]: Orchestrator pipeline: router selects agent -> decomposer creates subtask DAG -> executor coordinates
- [04-02]: Risk-level gates: high=always approval, medium=approval unless agent is_trusted, low=auto-approve
- [04-02]: Failed tool execution creates assistance request instead of auto-failing task
- [04-02]: Unknown tools default to high risk level for fail-safe behavior
- [04-02]: Token estimation uses task priority as complexity proxy with per-tool increments
- [04-03]: Slide-over panel uses fixed positioned div instead of Sheet component (not available in shadcn set)
- [04-03]: Kanban board is visual-only CSS grid -- no drag-and-drop library for MVP
- [04-03]: Approval polling uses 10s setInterval with Server Action fetch for near-real-time updates
- [04-03]: Client-side task filtering with useMemo rather than server re-fetch for instant response
- [04-03]: Native HTML checkbox for approval selection instead of shadcn Checkbox (not installed)
- [04-04]: Usage data aggregated server-side from usage_records rather than calling getUsageSummary service
- [04-04]: Executor creates assistance_request on routing failure instead of throwing (graceful degradation)
- [04-04]: Bulk reject uses two-click confirmation pattern instead of modal dialog
- [04-04]: Token usage displayed from both task-level fields and usage_records for completeness
- [04-05]: Fail-open on policy engine errors: evaluateRisk failure falls back to catalog risk only
- [04-05]: Max-of-two risk strategy: effective risk = higher of catalog risk and policy engine risk
- [04-05]: Approval action strings annotate when policy engine elevated the risk level
- [05-01]: Health service uses Promise.all for parallel query execution to minimize dashboard load time
- [05-01]: HealthDashboard replaces BusinessOverview as primary business page component
- [05-01]: Agent health grid uses Collapsible from shadcn/ui (base-ui) for expandable card detail
- [05-01]: Error rate color coding: green < 5%, amber 5-20%, red > 20%
- [05-02]: TypeToConfirmDialog uses Dialog (not AlertDialog) for programmatic open/close control
- [05-02]: Emergency service follows SupabaseClient-first-arg pattern with best-effort audit logging
- [05-02]: Audit log live tail polls every 5 seconds via setInterval with Server Action
- [05-02]: CSV/JSON export converts client-side via Blob URL and anchor click
- [05-02]: Tenant restore does NOT auto-unfreeze agents -- admin must manually review each
- [05-03]: Stub response generator uses keyword matching with random fallback for department-appropriate responses
- [05-03]: Conversation counter update uses direct UPDATE instead of RPC for PromiseLike type compatibility
- [05-03]: Message polling uses 10s setInterval with deduplication by message ID
- [05-03]: Typing indicator delays agent response display by 1.5s client-side (server call is immediate)
- [05-03]: File upload stores metadata only in message metadata field (storage upload deferred)
- [05-03]: Frozen agent detection checks both agentFrozen flag and absence of hasActiveAgent
- [06-01]: Duplicated deriveVpsAgentId in runtime generators to avoid circular dependency (core -> runtime -> core)
- [06-01]: VPS client uses native fetch with AbortController timeout instead of external HTTP library
- [06-01]: isVpsConfigured() enables graceful degradation when VPS env vars are missing
- [06-01]: OpenClaw generators are pure functions with no Supabase dependency for testability
- [06-01]: Each generator enforces character budget (AGENTS.md 8000, SOUL.md 4000, TOOLS.md 4000, USER.md 3000, IDENTITY.md 500)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-27
Stopped at: Completed 06-01-PLAN.md (VPS Foundations)
Resume file: .planning/phases/06-builder-and-automation/06-01-SUMMARY.md
