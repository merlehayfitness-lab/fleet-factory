---
phase: 18-enhanced-business-wizard-agent-hierarchy
plan: 02
subsystem: ui
tags: [wizard, department-tree, hover-tooltip, dynamic-providers, inline-editing, agent-hierarchy]

# Dependency graph
requires:
  - phase: 18-enhanced-business-wizard-agent-hierarchy
    provides: Server-side validation and template-aware provisioning (Plan 01)
provides:
  - Hover tooltips on department tree nodes with role, budget, model, and description
  - Dynamic API key provider list derived from selected department templates
  - Inline Edit buttons per section on review step for quick wizard navigation
  - Full hierarchy pre-selected by default when wizard loads
  - modelProfile field on DepartmentTemplate type for per-agent model display
affects: [wizard-ux, deployment-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [group-hover-tooltip, dynamic-provider-derivation, inline-review-editing]

key-files:
  created: []
  modified:
    - apps/web/_components/department-tree-select.tsx
    - apps/web/_components/create-business-wizard.tsx
    - apps/web/_components/wizard-api-keys-step.tsx

key-decisions:
  - "CSS group/group-hover tooltip used instead of shadcn Tooltip or external library for zero-dependency hover details"
  - "All templates pre-selected by default per user decision; admin deselects what they do not need"
  - "Provider derivation checks departmentType === 'rd' to trigger multi-model provider additions"
  - "WizardApiKeysStep accepts optional requiredProviders prop with fallback to hardcoded defaults for backward compatibility"
  - "Review step Edit buttons use setStep() directly rather than goToStep() to avoid re-validation when navigating backward"

patterns-established:
  - "group-hover tooltip: absolutely positioned div with invisible/visible toggle, pointer-events-none to prevent click interference"
  - "Dynamic provider derivation: deriveRequiredProviders() function that computes provider list from selected templates"
  - "Inline review editing: Ghost button Edit per card section that navigates back to the corresponding wizard step"

requirements-completed: [WIZ-03, HIER-03]

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 18 Plan 02: Wizard UX Polish Summary

**Hover tooltips on department tree nodes, dynamic API key provider list based on selected departments, and inline review editing with full hierarchy pre-selected by default**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T11:26:53Z
- **Completed:** 2026-04-01T11:31:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Department tree nodes now show name and role badge only; hovering reveals description, token budget, model profile, and role level in a tooltip
- API key providers dynamically update based on department selection -- selecting R&D agents adds OpenAI, Google, Mistral, and DeepSeek
- Review step has inline Edit buttons per section (Business Details, Departments, API Keys, Subdomain) that navigate back to the correct wizard step
- Full hierarchy is pre-selected by default (all 23 templates) per user decision from 18-CONTEXT.md
- All departments default to expanded so user sees full hierarchy on load

## Task Commits

Each task was committed atomically:

1. **Task 1: Add hover tooltips to department tree and enforce hierarchy rules** - `f975592` (feat)
2. **Task 2: Dynamic provider list, inline review editing, and wizard flow polish** - `bf2aa39` (feat)

## Files Created/Modified
- `apps/web/_components/department-tree-select.tsx` - Moved node details to hover tooltip, added modelProfile to type, selection count summary, all departments expanded by default
- `apps/web/_components/create-business-wizard.tsx` - Added modelProfile to all templates, DEFAULT_SELECTED set to all templates, deriveRequiredProviders() function, requiredProviders prop, inline Edit buttons on review step
- `apps/web/_components/wizard-api-keys-step.tsx` - Added requiredProviders prop and ProviderInfo export, falls back to defaults when prop not provided

## Decisions Made
- Used CSS group/group-hover tooltip pattern instead of shadcn Tooltip component or external library. This keeps zero additional dependencies and works well for this use case.
- All templates are pre-selected by default. The previous DEFAULT_SELECTED only included 12 of 23 templates. Updated to match user decision: "Full hierarchy pre-selected by default -- admin deselects what they don't need."
- Review step Edit buttons use setStep() directly (not goToStep()) to skip validation when navigating backward. This avoids blocking the user when they want to make a quick edit.
- WizardApiKeysStep accepts optional requiredProviders prop for backward compatibility. When not provided, it falls back to the existing hardcoded provider list.
- Provider derivation checks departmentType === "rd" to determine when to show multi-model providers. Anthropic is always required regardless of selection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 18 is complete (both plans delivered)
- Wizard UX matches all user decisions from 18-CONTEXT.md
- All 4 DB migrations (042, 043, 048, 049) need to be verified as applied to Supabase for end-to-end testing
- Ready for UAT or next phase

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 18-enhanced-business-wizard-agent-hierarchy*
*Completed: 2026-04-01*
