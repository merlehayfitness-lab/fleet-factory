---
phase: 09-skill-management-deployment
plan: 03
subsystem: ui, api
tags: [skills, templates, github-import, library, department-skills, sidebar-nav]

# Dependency graph
requires:
  - phase: 09-skill-management-deployment
    provides: skill service, templates, GitHub import, server actions, skill editor, assignment list, agent skills tab
provides:
  - Skill template browser dialog with department/role filters, preview, and copy-and-customize add flow
  - GitHub import dialog with URL validation, file/directory detection, content preview, and batch import
  - Standalone skill library page at /businesses/[id]/skills with search, filter, CRUD, and usage viewing
  - Department-level skill assignment panel with add/remove and inheritance description
  - Sidebar nav Skills item linking to skill library page
  - Wired "Add from Templates" and "Import from GitHub" buttons on agent Skills tab
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [dialog-driven browsing with card grid and filters, URL preview-before-import pattern, department skill inheritance panel]

key-files:
  created:
    - apps/web/_components/skill-template-browser.tsx
    - apps/web/_components/github-import-dialog.tsx
    - apps/web/_components/skill-library.tsx
    - apps/web/_components/department-skills-panel.tsx
    - apps/web/app/(dashboard)/businesses/[id]/skills/page.tsx
  modified:
    - apps/web/_actions/skill-actions.ts
    - apps/web/_components/agent-skills-tab.tsx
    - apps/web/_components/sidebar-nav.tsx
    - apps/web/app/(dashboard)/businesses/[id]/departments/page.tsx

key-decisions:
  - "SkillTemplateBrowser uses controlled Dialog (open/onOpenChange) instead of embedded DialogTrigger for reuse from multiple contexts"
  - "GitHub import uses two-phase flow: preview first (previewGitHubUrlAction), then import (importFromGitHubAction) to avoid blind imports"
  - "getDepartmentSkillsAction queries skill_assignments directly (not via core service) to include assignment IDs needed for unassign"
  - "DropdownMenuTrigger uses inline className styling instead of asChild prop (base-ui does not support asChild)"

patterns-established:
  - "Two-phase import pattern: preview/validate before committing to database writes"
  - "Controlled Dialog pattern: open/onOpenChange props for reusable dialog components"
  - "Department skill panel pattern: client-side fetch with add/remove and inheritance description"

requirements-completed: [SKILL-02, SKILL-03, SKILL-04]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 9 Plan 3: Template Browser, GitHub Import, Skill Library, and Department Skills Summary

**Skill template browser with department/role card grid and copy-and-customize, GitHub import with URL preview and batch import, standalone skill library page with CRUD, and department-level skill assignment panels**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T16:32:22Z
- **Completed:** 2026-03-28T16:40:42Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Skill template browser dialog with filterable card grid (department/role), content preview in monospace, and one-click copy-and-customize that creates business library copy and optionally assigns to current agent
- GitHub import dialog with URL input, automatic file/directory detection via previewGitHubUrlAction, content preview for files, file listing for directories, and batch import that creates skills with source_type='imported' and source_url tracking
- Standalone skill library page at /businesses/[id]/skills with search, source type filter, card grid with trigger phrases, kebab menu for usage viewing and soft-delete with "agents keep their copy" warning
- Department-level skill assignment panel on departments page with add/remove capability and "inherited by all agents" description
- Sidebar nav updated with "Skills" item (Sparkles icon) positioned after Templates
- Agent Skills tab "Add from Templates" and "Import from GitHub" buttons now fully wired (no longer disabled placeholders)

## Task Commits

Each task was committed atomically:

1. **Task 1: Server Action additions, template browser, GitHub import dialog, and agent skills tab wiring** - `0003267` (feat)
2. **Task 2: Skill library page, department skills panel, sidebar nav, and departments page update** - `72c1b8d` (feat)

## Files Created/Modified
- `apps/web/_actions/skill-actions.ts` - Added importFromGitHubAction, previewGitHubUrlAction, getDepartmentSkillsAction (with assignment IDs)
- `apps/web/_components/skill-template-browser.tsx` - Card grid template browser with department/role filters, preview, and copy-and-customize
- `apps/web/_components/github-import-dialog.tsx` - GitHub URL import dialog with preview step and batch import
- `apps/web/_components/skill-library.tsx` - Business skill library card grid with search, source filter, CRUD actions, and usage viewing
- `apps/web/_components/department-skills-panel.tsx` - Department-level skill assignment panel with add/remove and inheritance description
- `apps/web/_components/agent-skills-tab.tsx` - Wired template browser and GitHub import buttons (removed disabled placeholders)
- `apps/web/_components/sidebar-nav.tsx` - Added Skills nav item with Sparkles icon after Templates
- `apps/web/app/(dashboard)/businesses/[id]/skills/page.tsx` - Standalone skill library page route
- `apps/web/app/(dashboard)/businesses/[id]/departments/page.tsx` - Added DepartmentSkillsPanel for each department

## Decisions Made
- SkillTemplateBrowser uses controlled Dialog (open/onOpenChange props) rather than embedded DialogTrigger, enabling reuse from both agent Skills tab and standalone library page
- GitHub import uses a two-phase approach: previewGitHubUrlAction validates and shows content before importFromGitHubAction commits to database writes
- getDepartmentSkillsAction queries skill_assignments table directly with join to include assignment IDs, since the core getSkillsForDepartment returns Skill[] without assignment context needed for unassign
- DropdownMenuTrigger in skill library uses inline className styling instead of asChild prop (base-ui does not support asChild)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed lucide-react Github icon not exported**
- **Found during:** Task 1
- **Issue:** `Github` is not an exported member of lucide-react v1.6.0; import failed
- **Fix:** Replaced with `GitBranch` icon for GitHub-related buttons
- **Files modified:** apps/web/_components/agent-skills-tab.tsx, apps/web/_components/github-import-dialog.tsx
- **Committed in:** 0003267 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed base-ui asChild and Select type incompatibilities**
- **Found during:** Task 2
- **Issue:** DropdownMenuTrigger `asChild` prop not supported in base-ui; Select onValueChange passes `string | null` not `string`
- **Fix:** Used inline className on DropdownMenuTrigger; added explicit `(v: string | null)` type annotation on Select onValueChange
- **Files modified:** apps/web/_components/skill-library.tsx, apps/web/_components/department-skills-panel.tsx
- **Committed in:** 72c1b8d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for typecheck correctness. No scope creep.

## Issues Encountered
None beyond the type errors documented as deviations.

## User Setup Required
None - no external service configuration required. The 036 migration must already be applied to Supabase (from 09-01).

## Next Phase Readiness
- Phase 9 is now complete (all 3 plans executed)
- Full skill management system operational: schema, service, compiler, deployment pipeline, editor, assignment, templates, import, library, department skills
- All UI components wired and accessible from sidebar nav and agent detail page

## Self-Check: PASSED

All 9 files verified present. Both task commits (0003267, 72c1b8d) verified in git log.

---
*Phase: 09-skill-management-deployment*
*Completed: 2026-03-28*
