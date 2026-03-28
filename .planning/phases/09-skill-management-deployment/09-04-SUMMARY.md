---
phase: 09-skill-management-deployment
plan: 04
subsystem: api, ui
tags: [github-api, git-trees, recursive-import, collection-grouping, skill-management]

# Dependency graph
requires:
  - phase: 09-skill-management-deployment
    provides: GitHub import dialog, skill library, skill service, fetchGitHubDirectory
provides:
  - Recursive directory import using Git Trees API with ?recursive=1
  - import_collection column on skills table for grouping imported skills by repo name
  - Nested file tree preview in GitHub import dialog
  - Collection filter in skill library
affects: [skill-management, deployment-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Git Trees API with ?recursive=1 for full repository tree discovery"
    - "import_collection tagging for grouping imported skills by source repo"

key-files:
  created: []
  modified:
    - packages/core/skill/github-import.ts
    - packages/core/skill/skill-types.ts
    - packages/core/skill/skill-service.ts
    - packages/db/schema/036_skills_tables.sql
    - packages/db/schema/_combined_schema.sql
    - apps/web/_actions/skill-actions.ts
    - apps/web/_components/github-import-dialog.tsx
    - apps/web/_components/skill-library.tsx

key-decisions:
  - "Replaced Contents API with Git Trees API for recursive directory scanning"
  - "import_collection stored as nullable text column with conditional index on business_id"

patterns-established:
  - "Git Trees API pattern: fetch full tree once, filter client-side by path prefix and extension"
  - "Collection grouping: directory imports tagged with repo name for library filtering"

requirements-completed: [SKILL-01, SKILL-02, SKILL-03, SKILL-04]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 9 Plan 4: Recursive GitHub Import with Collection Grouping Summary

**Recursive Git Trees API import scanning all subdirectories for .md files with repo-name collection tagging and library filtering**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T18:23:29Z
- **Completed:** 2026-03-28T18:27:17Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- fetchGitHubDirectory now uses Git Trees API with ?recursive=1 to discover .md files in all subdirectories (closes UAT test 8 gap)
- Skills imported from directory imports are tagged with repo name as import_collection for grouping
- Import dialog shows nested file tree preview with folder icons and subdirectory structure
- Skill library gains collection filter dropdown and collection badges on skill cards

## Task Commits

Each task was committed atomically:

1. **Task 1: Add import_collection column, update Skill type, and make fetchGitHubDirectory recursive** - `c7b0f22` (feat)
2. **Task 2: Update import actions, import dialog, and library to support recursive import with collections** - `9ae2bd3` (feat)

## Files Created/Modified
- `packages/db/schema/036_skills_tables.sql` - Added import_collection column with conditional index
- `packages/db/schema/_combined_schema.sql` - Same ALTER TABLE addition for combined schema
- `packages/core/skill/skill-types.ts` - Added import_collection field to Skill interface
- `packages/core/skill/github-import.ts` - Replaced Contents API with Git Trees API for recursive scanning
- `packages/core/skill/skill-service.ts` - Updated createSkill to accept optional import_collection
- `apps/web/_actions/skill-actions.ts` - Preview returns full paths and repoName; import sets import_collection
- `apps/web/_components/github-import-dialog.tsx` - Nested file tree preview with folder structure and collection note
- `apps/web/_components/skill-library.tsx` - Collection filter dropdown and amber collection badges

## Decisions Made
- Replaced Contents API with Git Trees API: Contents API only lists single directory level, Git Trees API with ?recursive=1 returns entire repository tree in one call
- import_collection stored as nullable text (not FK): repo name is external metadata, no normalized table needed
- Collection filter only shown when at least one skill has import_collection set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UAT test 8 gap (recursive directory import) is closed
- Backward compatibility preserved: single file imports and existing skills unaffected
- Collection grouping enables future features like bulk collection management

---
*Phase: 09-skill-management-deployment*
*Completed: 2026-03-28*
