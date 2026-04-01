---
phase: 18-enhanced-business-wizard-agent-hierarchy
plan: 01
subsystem: api, ui
tags: [server-actions, supabase, validation, api-keys, subdomain, agent-hierarchy, provisioning]

# Dependency graph
requires:
  - phase: 17-vps-activation-embedded-terminal
    provides: SSH deploy infrastructure and port allocation
  - phase: 13
    provides: Provider credentials encryption (saveProviderCredentials)
provides:
  - checkSubdomainAvailability server action with real DB uniqueness query
  - validateApiKey server action with real HTTP calls to 5 providers (Anthropic, OpenAI, Google, Mistral, DeepSeek)
  - Template-aware provisioning in createBusinessV2 (departments and agents from selected templates)
  - Agent hierarchy resolution (CEO -> dept heads -> specialists via parent_agent_id)
affects: [18-02, wizard-ux, deployment-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-action-validation, parallel-api-key-validation, template-to-agent-resolution, hierarchy-order-provisioning]

key-files:
  created: []
  modified:
    - apps/web/_actions/business-actions.ts
    - apps/web/_components/wizard-subdomain-step.tsx
    - apps/web/_components/wizard-api-keys-step.tsx
    - apps/web/_components/create-business-wizard.tsx

key-decisions:
  - "Short ID to template name mapping used because wizard uses static string IDs while DB uses UUIDs"
  - "V2 provisioning is additive after base RPC (not replacing it) -- base creates 4 default departments, V2 adds missing ones"
  - "Parent resolution falls back to department head lookup when parent_template_id is null on specialists"
  - "Anthropic key validation blocks wizard advancement via goToStep gate using real API call"
  - "DeepSeek added as 5th provider in API keys step for R&D Council support"

patterns-established:
  - "Server action validation: real API calls with AbortController timeout and per-provider switch/case"
  - "Template-aware provisioning: sort by role_level, create in hierarchy order, track templateId->agentId map for parent resolution"
  - "Debounced server action call: 500ms setTimeout with cleanup pattern for subdomain availability"

requirements-completed: [WIZ-01, WIZ-02, HIER-01, HIER-02]

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 18 Plan 01: Server Validation & Template-Aware Provisioning Summary

**Real subdomain availability checking, live API key validation for 5 providers, and template-aware agent provisioning with CEO->head->specialist hierarchy resolution**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T11:18:26Z
- **Completed:** 2026-04-01T11:23:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Subdomain availability check now queries the real businesses table with format validation and debounced UI
- API key validation makes actual HTTP test calls to Anthropic, OpenAI, Google, Mistral, and DeepSeek endpoints
- createBusinessV2 now provisions departments and agents from the selected template list with proper parent_agent_id chains
- Agent hierarchy is correct: CEO (role_level 0) created first, department heads (1) reference CEO, specialists (2) reference their department head
- Redirect after wizard submission goes to /businesses/[id]/deployments
- SSH deploy now uses real agent IDs resolved from provisioned agents

## Task Commits

Each task was committed atomically:

1. **Task 1: Add server-side validation actions and wire subdomain/API key checks** - `c005378` (feat)
2. **Task 2: Extend createBusinessV2 for template-aware provisioning** - `6026d2d` (feat)

## Files Created/Modified
- `apps/web/_actions/business-actions.ts` - Added checkSubdomainAvailability, validateApiKey, and provisionV2Agents; extended createBusinessV2 with template-aware provisioning
- `apps/web/_components/wizard-subdomain-step.tsx` - Replaced stub availability check with real server action call
- `apps/web/_components/wizard-api-keys-step.tsx` - Added DeepSeek provider, per-key Validate button, Validate All parallel validation, validation status badges
- `apps/web/_components/create-business-wizard.tsx` - Added Anthropic key validation gate on step advancement

## Decisions Made
- Used short ID to template name mapping because the wizard uses static string IDs (e.g., "ceo", "mkt-dir") while the DB uses UUID IDs. This mapping table allows the wizard to remain decoupled from DB UUIDs.
- V2 provisioning is additive after the base RPC -- the base creates 4 default departments and their agents, then provisionV2Agents adds any missing departments (executive, marketing, rd, hr) and agents from selected templates, skipping duplicates.
- Parent agent resolution uses three strategies: (1) explicit parent_template_id, (2) department heads default to CEO, (3) specialists without parent_template_id default to their department head.
- Anthropic key validation blocks wizard advancement at goToStep level using a real API call, not just length check.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server-side validation and provisioning are complete
- Plan 02 (wizard UX polish) can proceed with dynamic provider list, hover tooltips, and inline review editing
- All 4 DB migrations (042, 043, 048, 049) need to be verified as applied to Supabase for end-to-end testing

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 18-enhanced-business-wizard-agent-hierarchy*
*Completed: 2026-04-01*
