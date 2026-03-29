---
phase: 10-template-profiles-model-configuration
plan: 01
subsystem: api
tags: [claude-models, mcp, tool-profile, model-constants, metering, migration]

# Dependency graph
requires:
  - phase: 09-skill-management-deployment
    provides: "Skills tables and service layer for agent skill management"
provides:
  - "CLAUDE_MODELS constant with 6 models (3 latest, 3 legacy) as single source of truth"
  - "ToolProfileShape and McpServerConfig interfaces for structured tool_profile JSONB"
  - "KNOWN_MCP_SERVERS catalog with 6 entries for quick MCP server setup"
  - "DEPARTMENT_DEFAULT_MODELS and DEPARTMENT_DEFAULT_TOOL_PROFILES for per-department defaults"
  - "Migration 037 seeding agent_templates with per-department model and tool defaults"
  - "MODEL_PRICING map with full API model IDs and backward-compat shorthand aliases"
  - "syncFromTemplate function for agent-template profile synchronization"
affects: [10-02, 10-03, ui, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized model constants pattern (CLAUDE_MODELS as single source of truth)"
    - "Structured tool_profile shape (ToolProfileShape with McpServerConfig)"
    - "Known MCP server catalog with configFields for UI form generation"

key-files:
  created:
    - "packages/core/agent/model-constants.ts"
    - "packages/core/agent/tool-profile-schema.ts"
    - "packages/db/schema/037_template_profile_defaults.sql"
  modified:
    - "packages/core/index.ts"
    - "packages/core/server.ts"
    - "packages/core/worker/metering.ts"
    - "packages/core/prompt-generator/test-chat-service.ts"
    - "packages/core/prompt-generator/generator-service.ts"
    - "packages/core/agent/service.ts"
    - "packages/db/schema/_combined_schema.sql"

key-decisions:
  - "MODEL_PRICING updated from legacy flat-rate pricing to model-specific per-MTok pricing with backward-compat aliases"
  - "CLAUDE_MODELS uses dynamic lookup (find latest sonnet) instead of hardcoded strings in test-chat and generator services"
  - "syncFromTemplate audit log uses actor_id from supabase.auth.getUser() for traceability"

patterns-established:
  - "Model constants pattern: All model references use CLAUDE_MODELS constant via getModelById/getModelFriendlyName"
  - "Tool profile shape: ToolProfileShape with allowed_tools array and mcp_servers array as standard JSONB structure"
  - "MCP catalog pattern: KNOWN_MCP_SERVERS with configFields for dynamic UI form generation"

requirements-completed: [TMPL-01, TMPL-02, TMPL-03, TMPL-04]

# Metrics
duration: 6min
completed: 2026-03-29
---

# Phase 10 Plan 01: Model Constants & Tool Profile Schema Summary

**CLAUDE_MODELS constant with 6 models, ToolProfileShape with MCP server support, migration 037 for department defaults, and metering model-ID aliasing**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-29T15:57:16Z
- **Completed:** 2026-03-29T16:03:38Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Single source of truth for Claude model metadata (CLAUDE_MODELS) with 6 models, pricing, tiers, and lookup helpers
- Structured tool profile type system (ToolProfileShape, McpServerConfig) with MCP server catalog and department defaults
- Migration 037 seeds agent_templates with per-department model and tool defaults (idempotent-safe)
- Metering module expanded with model-specific pricing covering both full API IDs and legacy shorthand aliases
- Hardcoded model strings eliminated from test-chat-service and generator-service
- syncFromTemplate function enables agent-template profile synchronization with audit logging

## Task Commits

Each task was committed atomically:

1. **Task 1: Model constants, tool profile schema, MCP catalog, and department defaults** - `e0c892e` (feat)
2. **Task 2: Seed migration, metering aliases, hardcoded model replacement, and syncFromTemplate** - `f6d9a9c` (feat)

## Files Created/Modified
- `packages/core/agent/model-constants.ts` - Claude model definitions, department defaults, lookup helpers
- `packages/core/agent/tool-profile-schema.ts` - Tool profile shape, MCP server config, known MCP catalog, department defaults, URL validation
- `packages/db/schema/037_template_profile_defaults.sql` - Migration to populate templates with per-department defaults
- `packages/db/schema/_combined_schema.sql` - Appended migration 037 content
- `packages/core/index.ts` - Added model and tool profile type/constant exports
- `packages/core/server.ts` - Added validateMcpServerUrl and syncFromTemplate exports
- `packages/core/worker/metering.ts` - Expanded MODEL_PRICING with full API IDs and shorthand aliases
- `packages/core/prompt-generator/test-chat-service.ts` - Replaced hardcoded model with CLAUDE_MODELS lookup
- `packages/core/prompt-generator/generator-service.ts` - Replaced hardcoded model with CLAUDE_MODELS lookup
- `packages/core/agent/service.ts` - Added syncFromTemplate function with audit logging

## Decisions Made
- MODEL_PRICING updated from legacy flat-rate pricing (opus $15/$75) to current API pricing (opus $5/$25) while preserving shorthand aliases for backward compat with existing usage_records
- CLAUDE_MODELS uses dynamic lookup (find latest sonnet) instead of hardcoded strings in test-chat and generator services
- syncFromTemplate audit log uses actor_id from supabase.auth.getUser() for traceability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deferred syncFromTemplate server.ts export to Task 2**
- **Found during:** Task 1
- **Issue:** Plan specified adding syncFromTemplate export to server.ts in Task 1, but the function is only created in Task 2
- **Fix:** Added validateMcpServerUrl export only in Task 1, then added syncFromTemplate export in Task 2 after the function was created
- **Files modified:** packages/core/server.ts
- **Verification:** pnpm turbo typecheck passes after both tasks
- **Committed in:** e0c892e (Task 1), f6d9a9c (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Sequencing adjustment only. No scope creep. All planned functionality delivered.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Model constants and tool profile types ready for consumption by UI components in plans 10-02 and 10-03
- DEPARTMENT_DEFAULT_MODELS and DEPARTMENT_DEFAULT_TOOL_PROFILES available for model/tool selector dropdowns
- KNOWN_MCP_SERVERS catalog ready for MCP server configuration UI
- syncFromTemplate ready for "Reset to template" action in agent detail views
- Migration 037 ready to apply to database (seeds template defaults)

---
*Phase: 10-template-profiles-model-configuration*
*Completed: 2026-03-29*
