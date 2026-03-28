---
phase: 08-role-definition-and-prompt-generation
plan: 03
subsystem: ui
tags: [wizard, agent-setup, role-templates, prompt-generation, knowledge-upload, multi-step-form]

# Dependency graph
requires:
  - phase: 08-01
    provides: "PromptRefinementPanel, TestChatDialog, generatePromptAction, RoleDefinitionCard pattern"
  - phase: 08-02
    provides: "Department hierarchy, sub-agent support, SKILL.md pipeline"
  - phase: 07-02
    provides: "KnowledgeUploadZone, KnowledgeDocumentList, knowledge actions"
provides:
  - "5-step agent setup wizard at /businesses/[id]/agents/new"
  - "Curated role template library with 8 templates across 4 department types"
  - "Wizard Server Actions for provisional agent creation, finalization, and deletion"
  - "New Agent button on agents list page"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Provisional agent pattern (status=provisioning until finalized)", "Multi-step wizard with shared state via parent component"]

key-files:
  created:
    - "packages/core/prompt-generator/templates/role-templates.ts"
    - "apps/web/_actions/agent-wizard-actions.ts"
    - "apps/web/_components/agent-setup-wizard.tsx"
    - "apps/web/_components/wizard-basic-info-step.tsx"
    - "apps/web/_components/wizard-knowledge-step.tsx"
    - "apps/web/_components/wizard-role-definition-step.tsx"
    - "apps/web/_components/wizard-prompt-generation-step.tsx"
    - "apps/web/_components/wizard-review-step.tsx"
    - "apps/web/app/(dashboard)/businesses/[id]/agents/new/page.tsx"
  modified:
    - "packages/core/index.ts"
    - "apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx"

key-decisions:
  - "Provisional agent created on transition from Step 1 to Step 2 (not on page load) to avoid orphans from abandoned first steps"
  - "Knowledge step polls documents every 5s and blocks wizard Next button while any doc is uploading/processing"
  - "Role template selector pre-fills all fields but preserves existing linked_integrations and linked_knowledge_docs from wizard context"
  - "Review step uses collapsible sections (local useState toggle) for each prompt section, matching lightweight pattern from 07-03"

patterns-established:
  - "Provisional agent pattern: create with status=provisioning, finalize to active on wizard completion"
  - "Wizard step components receive state + callbacks from parent, no direct server action calls except Knowledge step"

requirements-completed: [ROLE-04]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 8 Plan 3: Agent Setup Wizard Summary

**5-step agent setup wizard with curated role templates, knowledge upload blocking, Claude prompt generation with refinement, and sub-agent detection per department**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T02:28:17Z
- **Completed:** 2026-03-28T02:34:40Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Curated role template library with 8 templates across 4 department types (Owner, Sales, Support, Operations)
- 5-step wizard: Basic Info (name, department with agent count + sub-agent detection, role) -> Knowledge Upload (provisional agent, blocks until processed) -> Role Definition (template selector pre-fills fields) -> Prompt Generation (Claude generates with refinement + test chat) -> Review (collapsible summary with Create Agent button)
- Wizard Server Actions for provisional agent lifecycle: create, finalize to active, delete provisioning agents
- New Agent button on agents list page linking to wizard

## Task Commits

Each task was committed atomically:

1. **Task 1: Role template library, wizard Server Actions, and wizard route page** - `9f7233c` (feat)
2. **Task 2: Wizard parent component and 5 step components** - `45dd344` (feat)

## Files Created/Modified
- `packages/core/prompt-generator/templates/role-templates.ts` - Curated role template library (8 templates, 4 department types)
- `packages/core/index.ts` - Added RoleTemplate type and template exports
- `apps/web/_actions/agent-wizard-actions.ts` - Server Actions for wizard flow (create, finalize, delete, dept query)
- `apps/web/app/(dashboard)/businesses/[id]/agents/new/page.tsx` - Wizard route page (Server Component)
- `apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx` - Added New Agent button
- `apps/web/_components/agent-setup-wizard.tsx` - Wizard parent managing 5-step state
- `apps/web/_components/wizard-basic-info-step.tsx` - Step 1: name, department, role
- `apps/web/_components/wizard-knowledge-step.tsx` - Step 2: knowledge upload with polling
- `apps/web/_components/wizard-role-definition-step.tsx` - Step 3: template selector + structured fields
- `apps/web/_components/wizard-prompt-generation-step.tsx` - Step 4: Claude generation + refinement + test chat
- `apps/web/_components/wizard-review-step.tsx` - Step 5: collapsible summary + Create Agent

## Decisions Made
- Provisional agent created on Step 1 -> Step 2 transition (not page load) to reduce orphaned provisional agents
- Knowledge step blocks Next button while documents are uploading/processing (5s polling)
- Template selector preserves linked_integrations and linked_knowledge_docs when pre-filling from template
- Review step uses local useState for collapsible sections (lightweight, no extra component import)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 8 fully complete (all 3 plans executed)
- Agent setup wizard connects all prior work: Phase 7 knowledge upload, 08-01 prompt generation/refinement, 08-02 hierarchy and SKILL.md
- MVP feature set complete across all 8 phases

## Self-Check: PASSED

- All 11 files verified present on disk
- Both commits (9f7233c, 45dd344) verified in git log
- `pnpm turbo typecheck` passes cleanly

---
*Phase: 08-role-definition-and-prompt-generation*
*Completed: 2026-03-28*
