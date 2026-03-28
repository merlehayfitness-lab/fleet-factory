---
phase: 09-skill-management-deployment
plan: 01
subsystem: database, api
tags: [skills, supabase, rls, github-import, openclaw, deployment]

# Dependency graph
requires:
  - phase: 08-role-definition-and-prompt-generation
    provides: agent skill_definition field, department_skill field, OpenClaw workspace generators
provides:
  - skills table with RLS and soft-delete for per-tenant skill management
  - skill_assignments table with agent/department targeting and CHECK constraint
  - skill_templates table with 10 seeded starter templates across 4 departments
  - Skill service module (CRUD, assignment, querying, templates)
  - Skill compiler for multi-skill merge with department-first ordering and name precedence
  - GitHub import service for public repo URL parsing and content fetching
  - Updated OpenClaw generators with multi-skill array support
  - Updated deployment pipeline with per-agent skill querying
affects: [09-02-PLAN, 09-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-skill compilation with precedence, overloaded function signatures for backward compatibility, soft-delete pattern]

key-files:
  created:
    - packages/db/schema/036_skills_tables.sql
    - packages/core/skill/skill-types.ts
    - packages/core/skill/skill-service.ts
    - packages/core/skill/skill-compiler.ts
    - packages/core/skill/github-import.ts
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/index.ts
    - packages/core/server.ts
    - packages/runtime/generators/openclaw-skill-md.ts
    - packages/runtime/generators/openclaw-workspace.ts
    - packages/core/deployment/service.ts

key-decisions:
  - "generateSkillMd uses TypeScript overloads for backward-compatible multi-skill support"
  - "Skill queries in deployment pipeline are non-blocking (warn on failure, deploy without multi-skill)"
  - "Department skills listed before agent skills in compiled SKILL.md with agent-level name precedence"

patterns-established:
  - "Soft-delete pattern: deleted_at column, library queries filter WHERE deleted_at IS NULL, assignments persist"
  - "Overloaded generator pattern: array-based new API with legacy string-based fallback"
  - "Non-blocking skill enrichment: deployment continues even if skill query fails"

requirements-completed: [SKILL-01, SKILL-02, SKILL-03, SKILL-04]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 9 Plan 1: Skills Schema, Service, and Deployment Pipeline Summary

**Skills table with RLS, 10 seeded templates, CRUD service, multi-skill compiler with precedence, GitHub import, and backward-compatible OpenClaw deployment pipeline integration**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T16:14:05Z
- **Completed:** 2026-03-28T16:20:25Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Database migration 036 with skills, skill_assignments, and skill_templates tables including RLS policies and 10 seeded starter templates across Owner (2), Sales (3), Support (2), Operations (3) departments
- Core skill module with full CRUD, assignment/unassignment, department inheritance querying, usage stats, and template copy-and-customize flow
- Skill compiler merges department and agent skills into a single SKILL.md with name-conflict precedence and 4000 char budget
- GitHub import parses blob/tree URLs and fetches raw content from public repos with timeout and rate-limit handling
- OpenClaw generators updated with dual-signature support (legacy two-blob + new multi-skill array)
- Deployment pipeline queries skill_assignments per agent via Promise.all and passes to workspace generator

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration, skill types, skill service, skill compiler, and GitHub import service** - `8089299` (feat)
2. **Task 2: Update OpenClaw generators and deployment pipeline for multi-skill model** - `d2052e8` (feat)

## Files Created/Modified
- `packages/db/schema/036_skills_tables.sql` - Migration with 3 tables, RLS, indexes, and 10 seeded templates
- `packages/db/schema/_combined_schema.sql` - Appended 035 and 036 migration content
- `packages/core/skill/skill-types.ts` - Skill, SkillAssignment, SkillTemplate, CompiledSkill, SkillWithAssignment, SkillUsage, GitHubUrlInfo, GitHubImportResult types
- `packages/core/skill/skill-service.ts` - Full CRUD, assignment, query, and template operations
- `packages/core/skill/skill-compiler.ts` - Multi-skill compilation with department-first ordering and name conflict resolution
- `packages/core/skill/github-import.ts` - GitHub URL parsing and public repo content fetching
- `packages/core/index.ts` - Added client-safe skill type exports
- `packages/core/server.ts` - Added server-only skill service, compiler, and GitHub import exports
- `packages/runtime/generators/openclaw-skill-md.ts` - Added SkillInput interface and array-based overload alongside legacy signature
- `packages/runtime/generators/openclaw-workspace.ts` - Extended AgentInput with optional skills array, conditional SKILL.md generation
- `packages/core/deployment/service.ts` - Added skill querying per agent before workspace generation

## Decisions Made
- generateSkillMd uses TypeScript function overloads to support both legacy (two text blobs) and new (SkillInput array) call patterns without breaking existing callers
- Skill queries in the deployment pipeline are non-blocking: if querying skills for an agent fails, deployment continues with the legacy skill_definition fallback
- Department skills are listed before agent skills in the compiled SKILL.md; when an agent skill has the same name as a department skill, the department version is skipped with a comment noting the override

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The 036 migration SQL must be applied to Supabase when ready to use skills.

## Next Phase Readiness
- Schema and services ready for Plan 09-02 (skill editor UI, assignment UI, agent Skills tab)
- All types and services exported from core barrels for use by web app server actions
- Deployment pipeline ready to consume skills assigned through the upcoming UI

---
*Phase: 09-skill-management-deployment*
*Completed: 2026-03-28*
