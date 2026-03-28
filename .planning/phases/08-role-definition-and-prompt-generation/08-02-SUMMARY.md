---
phase: 08-role-definition-and-prompt-generation
plan: 02
subsystem: runtime, ui, database
tags: [skill-md, openclaw, hierarchy, parent-child, agents, departments]

# Dependency graph
requires:
  - phase: 08-01
    provides: role_definition and skill_definition columns on agents table, agent hierarchy columns (parent_agent_id, role)
provides:
  - department_skill column on departments table via migration 034
  - SKILL.md generator with 4-case merge logic (neither/dept/agent/both)
  - SKILL.md deployed per agent in OpenClaw workspace (6 files total per agent)
  - Hierarchy-aware agents list UI with lead/sub-agent grouping
  - Agent detail parent/child relationship display with navigation links
  - Agent service getChildAgents and getParentAgent query functions
affects: [08-03, deployment, agent-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [lead-sub-agent hierarchy display, SKILL.md merge strategy, department-level skill baseline]

key-files:
  created:
    - packages/db/schema/034_department_skill.sql
    - packages/runtime/generators/openclaw-skill-md.ts
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/agent/service.ts
    - packages/runtime/generators/openclaw-workspace.ts
    - packages/runtime/index.ts
    - packages/core/deployment/service.ts
    - apps/web/_actions/deployment-actions.ts
    - apps/web/_components/agents-list.tsx
    - apps/web/_components/agent-card.tsx
    - apps/web/_components/agent-detail-tabs.tsx
    - apps/web/_components/agent-overview.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx

key-decisions:
  - "SKILL.md 4-case merge: neither=default, dept-only=baseline, agent-only=direct, both=section-concatenation with Department Baseline and Agent Specialization headers"
  - "Character budget 4000 chars on SKILL.md with truncation"
  - "Lead agents identified by parent_agent_id IS NULL, sub-agents indented with border-left connector"
  - "Agent detail page header shows Sub-agent of {parent} link for sub-agents"

patterns-established:
  - "SKILL.md generation pattern: pure function merging department baseline with agent specialization"
  - "Agent hierarchy display: leads at top, sub-agents indented with pl-6 and border-l-2"
  - "Related agent sections in overview: Reports To and Sub-Agents cards with navigation links"

requirements-completed: [ROLE-05, ROLE-06]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 8 Plan 2: Department Hierarchy & SKILL.md Pipeline Summary

**Multi-agent department hierarchy with lead/sub-agent UI and SKILL.md generator merging department baseline with agent specialization into OpenClaw deployment pipeline**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T02:19:11Z
- **Completed:** 2026-03-28T02:24:56Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Department skill column added via migration 034, enabling department-level baseline skills
- SKILL.md generator handles all 4 merge cases with character budget enforcement
- OpenClaw workspace now produces 6 files per agent (AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md, USER.md, SKILL.md)
- Agents list shows hierarchical grouping with lead agents prominent and sub-agents indented below
- Agent detail pages display parent/child relationships with navigation links and "Reports To" / "Sub-Agents" sections
- Agent service supports hierarchy queries (getChildAgents, getParentAgent) and extended updateAgentConfig

## Task Commits

Each task was committed atomically:

1. **Task 1: Department skill migration, SKILL.md generator, workspace and deployment pipeline updates** - `78ef043` (feat)
2. **Task 2: Agents list hierarchy display and agent detail parent/child relationships** - `7eef1f1` (feat)

## Files Created/Modified
- `packages/db/schema/034_department_skill.sql` - Migration adding department_skill text column to departments
- `packages/db/schema/_combined_schema.sql` - Appended 034 migration section
- `packages/runtime/generators/openclaw-skill-md.ts` - Pure function SKILL.md generator with 4-case merge logic
- `packages/runtime/generators/openclaw-workspace.ts` - Extended with SKILL.md generation, skill_definition on AgentInput, department_skill on DepartmentInput
- `packages/runtime/index.ts` - Added generateSkillMd export
- `packages/core/agent/service.ts` - Added getChildAgents, getParentAgent, extended updateAgentConfig with role and parent_agent_id
- `packages/core/deployment/service.ts` - Updated agent/department queries to include skill fields, passes them to workspace generator
- `apps/web/_actions/deployment-actions.ts` - Updated queries and workspace call to include skill fields
- `apps/web/_components/agents-list.tsx` - Restructured for lead/sub-agent hierarchy display with role badges
- `apps/web/_components/agent-card.tsx` - Added role prop with Badge display next to agent name
- `apps/web/_components/agent-detail-tabs.tsx` - Extended with parentAgent and childAgents props, role and parent_agent_id on Agent interface
- `apps/web/_components/agent-overview.tsx` - Added Reports To and Sub-Agents card sections, role display in hero section
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` - Added parent/child agent queries, Sub-agent of header link

## Decisions Made
- SKILL.md merge strategy uses section-based concatenation (Department Baseline / Agent Specialization) when both skills exist, avoiding complex conflict resolution
- Character budget set at 4000 chars with simple truncation (matches other OpenClaw generators' budget approach)
- Lead/sub-agent separation uses parent_agent_id IS NULL check; orphaned sub-agents (parent not in same department) shown flat
- Agent detail fetches parent and children as separate queries rather than using joins, keeping the page data flow simple

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed deployment-actions.ts type error from new required interface fields**
- **Found during:** Task 1 (typecheck verification)
- **Issue:** apps/web/_actions/deployment-actions.ts called generateOpenClawWorkspace without the new skill_definition and department_skill fields, causing TS2741
- **Fix:** Updated agent query to include skill_definition, department query to include department_skill, and mapped both fields in the workspace call
- **Files modified:** apps/web/_actions/deployment-actions.ts
- **Verification:** pnpm turbo typecheck passes
- **Committed in:** 78ef043 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix -- the plan omitted this file from the files_modified list. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The 034 migration must be applied to the database.

## Next Phase Readiness
- SKILL.md pipeline is complete and ready for the agent setup wizard (08-03)
- Parent/child hierarchy UI is ready; wizard can create sub-agents in existing departments
- Department skill column available for wizard to set department-level baselines

## Self-Check: PASSED

All 13 key files verified present. Both task commits (78ef043, 7eef1f1) verified in git log.

---
*Phase: 08-role-definition-and-prompt-generation*
*Completed: 2026-03-28*
