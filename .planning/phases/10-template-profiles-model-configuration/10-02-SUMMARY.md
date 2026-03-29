---
phase: 10-template-profiles-model-configuration
plan: 02
subsystem: ui
tags: [model-selector, mcp-server, tool-profile, drawer, form-json-toggle, template-form, agent-config]

# Dependency graph
requires:
  - phase: 10-template-profiles-model-configuration
    provides: "CLAUDE_MODELS, ToolProfileShape, KNOWN_MCP_SERVERS, department defaults from plan 01"
provides:
  - "ModelSelector dropdown component with friendly names and latest/legacy toggle"
  - "McpServerForm for per-server MCP configuration with test connection"
  - "ToolProfileForm with tool allowlist badges and MCP server catalog picker"
  - "ProfileEditorDrawer side panel with form/JSON bidirectional toggle"
  - "Updated template form with ModelSelector and tool profile summary card"
  - "Updated agent config with inline model dropdown and tool profile editing drawer"
  - "testMcpConnectionAction Server Action for MCP connectivity testing"
  - "Redeploy toast prompts after model or tool profile changes on agent config"
affects: [10-03, ui, agent-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Form/JSON bidirectional toggle with validation gating on JSON-to-form switch"
    - "Drawer panel pattern following task-detail-panel.tsx fixed-position side panel"
    - "Department default auto-switching on department type change in template form"
    - "Redeploy toast pattern with action button linking to deployments page"

key-files:
  created:
    - "apps/web/_components/model-selector.tsx"
    - "apps/web/_components/mcp-server-form.tsx"
    - "apps/web/_components/tool-profile-form.tsx"
    - "apps/web/_components/profile-editor-drawer.tsx"
  modified:
    - "apps/web/_components/template-form.tsx"
    - "apps/web/_components/agent-config.tsx"
    - "apps/web/_actions/agent-actions.ts"

key-decisions:
  - "testMcpConnectionAction added to agent-actions.ts (not template-actions.ts) since it serves both template and agent contexts"
  - "Tool profile summary card shows first 5 tool names as badges with +N overflow"
  - "Model changes on agent config page persist immediately via updateAgentConfigAction (no separate save step)"

patterns-established:
  - "ModelSelector pattern: Grouped by tier (Powerful/Balanced/Fast) with show-all toggle for legacy models"
  - "ProfileEditorDrawer pattern: Form/JSON toggle with JSON parse validation gating switch"
  - "Redeploy toast pattern: toast with action button linking to deployments page after config changes"

requirements-completed: [TMPL-01, TMPL-02, TMPL-03, TMPL-04]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 10 Plan 02: Model & Tool Profile UI Components Summary

**ModelSelector dropdown, ProfileEditorDrawer with form/JSON toggle, ToolProfileForm with MCP catalog picker, and template form/agent config page integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T16:06:55Z
- **Completed:** 2026-03-29T16:11:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ModelSelector dropdown shows Claude model friendly names grouped by tier with latest/legacy toggle
- ProfileEditorDrawer provides fixed-position side panel with bidirectional form/JSON toggle and JSON validation
- ToolProfileForm manages tool allowlist as removable badges with autocomplete and MCP server list with catalog picker
- McpServerForm handles per-server configuration with env vars, transport selection, and advisory Test Connection button
- Template form replaced raw JSON textareas with ModelSelector dropdown and tool profile summary card
- Agent config page replaced static JSON displays with interactive ModelSelector and ProfileEditorDrawer
- Department type change auto-switches model and tool defaults on template form
- Redeploy toast appears after model or tool profile changes on agent config

## Task Commits

Each task was committed atomically:

1. **Task 1: ModelSelector, McpServerForm, ToolProfileForm, and ProfileEditorDrawer components** - `d38885a` (feat)
2. **Task 2: Update template form and agent config page with model dropdown and profile editing** - `0c24cde` (feat)

## Files Created/Modified
- `apps/web/_components/model-selector.tsx` - Reusable model dropdown with friendly names, tier grouping, latest/legacy toggle
- `apps/web/_components/mcp-server-form.tsx` - Per-server MCP config form with env vars, test connection, remove confirmation
- `apps/web/_components/tool-profile-form.tsx` - Tool allowlist badges with autocomplete and MCP server catalog picker
- `apps/web/_components/profile-editor-drawer.tsx` - Side panel drawer with form/JSON bidirectional toggle and validation
- `apps/web/_components/template-form.tsx` - Replaced textareas with ModelSelector and tool profile summary card
- `apps/web/_components/agent-config.tsx` - Replaced static JSON with ModelSelector dropdown and tool profile summary with drawer
- `apps/web/_actions/agent-actions.ts` - Added testMcpConnectionAction for MCP server connectivity testing

## Decisions Made
- testMcpConnectionAction placed in agent-actions.ts since it serves both template and agent contexts via shared ToolProfileForm
- Tool profile summary card shows first 5 tool names as badges with +N overflow for density
- Model changes on agent config persist immediately via updateAgentConfigAction (inline save, no extra button)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 new components ready for consumption by plan 10-03 (UAT and final polish)
- ModelSelector used on both template form and agent config page as specified
- ProfileEditorDrawer accessible from both template form and agent config page
- MCP server catalog picker enables quick MCP server setup from KNOWN_MCP_SERVERS
- Redeploy toast pattern established for post-config-change workflows

## Self-Check: PASSED

All 8 files verified present. Both task commits (d38885a, 0c24cde) verified in git log.

---
*Phase: 10-template-profiles-model-configuration*
*Completed: 2026-03-29*
