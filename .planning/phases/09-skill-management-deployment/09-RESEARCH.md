# Phase 9: Skill Management & Deployment -- Research

**Researched:** 2026-03-28
**Phase Goal:** Admin can create, edit, import, and assign skills to agents and departments through a dedicated skill management interface. Skills are SKILL.md files that get routed to specific agents on the VPS.

## 1. Existing Code That Must Change

### Skill Definition Card (`apps/web/_components/skill-definition-card.tsx`)

Currently a simple card with inline edit toggle on the agent Config tab. Shows SKILL.md as monospace text with an Edit button. Phase 9 replaces this with a full split-pane editor (structured form left, live preview right). The existing card must be either replaced or significantly extended to support:
- Structured sections (name, description, instructions, trigger phrases)
- Live markdown preview pane
- Versioning (each edit creates a new version)
- Assignment status indicators ("inherited from department", "agent-specific")

### Agent Config Tab (`apps/web/_components/agent-config.tsx`)

Currently shows the SkillDefinitionCard inline. Phase 9 changes the skill interaction model: instead of editing SKILL.md directly on the config tab, skills are managed through a skill library with assignment. The config tab should show assigned skills (with inherited badge for department-level) and link to the skill editor. The `handleSkillSave` function and inline skill editing flow will be replaced with the assignment model.

### Agent Detail Tabs (`apps/web/_components/agent-detail-tabs.tsx`)

Currently 6 tabs: Overview, Config, Activity, Conversations, Integrations, Knowledge. Per the CONTEXT decisions, the skill editor lives inside the agent detail page. A new "Skills" tab is needed showing:
- Assigned skills list with checkboxes (check to assign, uncheck to remove)
- "Inherited" badge for department-level skills (cannot remove at agent level)
- "Add from templates" button
- "Import from GitHub" button
- Skill count badge

### Agents List (`apps/web/_components/agents-list.tsx`)

Per CONTEXT: "Skill count badge shown on agents list page (e.g., '3 skills')". The AgentCard component needs a skill count prop. The agents page query must include a skill count (either a joined count or a denormalized field).

### Agent Card (`apps/web/_components/agent-card.tsx`)

Needs a new `skillCount` prop to display a badge like "3 skills" alongside the existing role badge.

### Agent Service (`packages/core/agent/service.ts`)

Currently handles `updateAgentConfig()` which includes `skill_definition` as a single text field. Phase 9 changes the model: skills are separate entities assigned to agents, not a single text blob on the agent record. The `skill_definition` field on agents will remain for the merged/compiled SKILL.md (the deployment artifact), but skills are now managed through a separate `skills` table.

### OpenClaw SKILL.md Generator (`packages/runtime/generators/openclaw-skill-md.ts`)

Currently merges department_skill + agent skill_definition using a 4-case strategy. Phase 9 changes the input model: instead of a single `department_skill` and single `skill_definition`, the generator receives multiple assigned skills (some agent-level, some department-level). The merge function must be updated to concatenate all assigned skills into a single SKILL.md.

### OpenClaw Workspace Generator (`packages/runtime/generators/openclaw-workspace.ts`)

Currently passes `dept.department_skill` and `agent.skill_definition` to `generateSkillMd()`. Must be updated to accept an array of skills per agent (with inheritance markers) and compile them into the final SKILL.md.

### Deployment Service (`packages/core/deployment/service.ts`)

Lines 294-323 generate the OpenClaw workspace. Must be updated to:
- Query skills assigned to each agent (both direct and department-inherited)
- Pass the full skill list to the workspace generator
- Include skill version metadata in the deployment snapshot

### Sidebar Navigation (`apps/web/_components/sidebar-nav.tsx`)

Per CONTEXT: The template library is accessible from a standalone browse page. A "Skills" or "Skill Library" sidebar item should be added to the business sub-nav for the standalone library/browse page.

### Provision RPC (`packages/db/schema/010_provision_rpc.sql`)

Currently creates agents from templates. When skill templates are seeded in the database, the provisioning flow should auto-assign starter skills from the template library to newly created agents. This is an enhancement, not a blocker -- starter skill assignment can also be a post-provision step.

## 2. New Database Schema

### Skills Table

A new `skills` table stores individual skill definitions as first-class entities:

```sql
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text NOT NULL,          -- The SKILL.md content
  trigger_phrases text[],         -- Array of trigger phrases
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'imported', 'template')),
  source_url text,                -- GitHub URL for imported skills
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skills_business
  ON public.skills (business_id);
CREATE INDEX IF NOT EXISTS idx_skills_business_name
  ON public.skills (business_id, name);
```

Key design points:
- Skills are per-tenant (business_id scoped) -- no cross-business sharing
- `source_type` tracks origin: manual (created in editor), imported (from GitHub), template (from library)
- `source_url` stores the GitHub URL for imported skills (enables future "re-sync" feature)
- `version` increments on each edit (versioning per CONTEXT)
- `trigger_phrases` stored as Postgres text array for flexible matching
- `content` is the full SKILL.md text (the runtime artifact)

### Skill Assignments Table

A join table for many-to-many skill-to-agent/department assignment:

```sql
CREATE TABLE IF NOT EXISTS public.skill_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id uuid NOT NULL REFERENCES public.skills ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT skill_assignment_target CHECK (
    (agent_id IS NOT NULL AND department_id IS NULL)
    OR (agent_id IS NULL AND department_id IS NOT NULL)
  )
);

ALTER TABLE public.skill_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skill_assignments_agent
  ON public.skill_assignments (agent_id);
CREATE INDEX IF NOT EXISTS idx_skill_assignments_department
  ON public.skill_assignments (department_id);
CREATE INDEX IF NOT EXISTS idx_skill_assignments_skill
  ON public.skill_assignments (skill_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_assignments_unique_agent
  ON public.skill_assignments (skill_id, agent_id) WHERE agent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_assignments_unique_dept
  ON public.skill_assignments (skill_id, department_id) WHERE department_id IS NOT NULL;
```

Key design points:
- CHECK constraint ensures each assignment targets either an agent OR a department, not both
- Unique partial indexes prevent duplicate assignments
- Department-level assignment means all agents in that department inherit the skill
- Agent-level assignments take precedence when names conflict (per CONTEXT)
- CASCADE on skill delete removes assignments
- CASCADE on agent/department delete removes assignments for that entity

### Skill Templates Table

Per CONTEXT: "Templates stored in database, seeded on setup (not static files)." This differs from Phase 8's role templates which used a static TypeScript file. Skill templates are global (not per-business):

```sql
CREATE TABLE IF NOT EXISTS public.skill_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  content text NOT NULL,
  department_type text NOT NULL,
  role_type text,                 -- e.g., 'outreach', 'scheduling', 'analysis'
  trigger_phrases text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.skill_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skill_templates_department
  ON public.skill_templates (department_type);
CREATE INDEX IF NOT EXISTS idx_skill_templates_role
  ON public.skill_templates (role_type);
```

Key design points:
- Global table (no business_id) -- accessible by all tenants
- `department_type` enables filtering by department (Sales, Support, etc.)
- `role_type` enables secondary filtering (outreach, scheduling, analysis, etc.)
- Seeded with 2-3 starter templates per default department (8-12 total)
- System-managed only -- admins cannot add templates back to the library

### RLS Policies

```sql
-- skills: members read, owner/admin write
CREATE POLICY "skills_select_member" ON public.skills
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "skills_insert_admin" ON public.skills
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "skills_update_admin" ON public.skills
  FOR UPDATE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "skills_delete_admin" ON public.skills
  FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));

-- skill_assignments: same pattern
CREATE POLICY "skill_assignments_select_member" ON public.skill_assignments
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "skill_assignments_insert_admin" ON public.skill_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "skill_assignments_delete_admin" ON public.skill_assignments
  FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));

-- skill_templates: globally readable, admin-only writable
CREATE POLICY "skill_templates_select_authenticated" ON public.skill_templates
  FOR SELECT TO authenticated USING (true);
```

### Migration Numbering

Following the established pattern (034 was the last migration):
- `035_skills_tables.sql` -- skills, skill_assignments, skill_templates tables with RLS and seed data

## 3. New Dependencies Required

### No New NPM Dependencies

- GitHub URL fetching uses native `fetch()` (already available in Node.js 18+) -- no library needed
- Markdown preview can use a simple `<pre>` with whitespace-pre-wrap (matching existing SKILL.md display pattern) or rendered markdown via a lightweight approach
- All UI components available from existing shadcn/ui set (Card, Badge, Checkbox, Dialog, Tabs, Button, Textarea, Input)

### Optional: Markdown Rendering

Per CONTEXT Claude's Discretion: "Preview pane rendering style (rendered markdown vs raw)." For MVP, raw markdown in a monospace `<pre>` block (matching the existing SkillDefinitionCard pattern) is simplest. Rendered markdown can be added as a toggle later without any architecture change.

## 4. Architecture Decisions

### Skill Data Model

The key architectural shift from Phase 8: skills move from being a text field on agents (`skill_definition`) to being first-class entities with their own table and assignment system.

**Before (Phase 8):**
- `agents.skill_definition` -- single text blob per agent
- `departments.department_skill` -- single text blob per department
- Two-level merge at deployment time

**After (Phase 9):**
- `skills` table -- individual skill entities in business library
- `skill_assignments` table -- many-to-many assignment to agents and departments
- Multiple skills per agent/department
- Skills compiled into a single SKILL.md at deployment time

**Migration path for existing data:**
- Agents with existing `skill_definition` values: create a skill entity and agent assignment during migration
- Departments with existing `department_skill` values: create a skill entity and department assignment during migration
- The `skill_definition` column on agents becomes a computed/compiled field (or can be deprecated in favor of querying assignments at deploy time)

### Skill Service Module

New module: `packages/core/skill/`

```
packages/core/skill/
  skill-types.ts       -- Skill, SkillAssignment, SkillTemplate types
  skill-service.ts     -- CRUD: create, update, delete, list, get, assign, unassign
  skill-compiler.ts    -- Compiles assigned skills into a single SKILL.md for deployment
  github-import.ts     -- Fetches skill content from GitHub URLs
```

### Skill Compiler

The compiler replaces the current `generateSkillMd()` two-way merge. It takes an ordered list of skills (department-inherited first, then agent-specific) and produces a single SKILL.md:

```typescript
interface CompiledSkill {
  content: string;    // The merged SKILL.md
  sources: Array<{
    skillId: string;
    name: string;
    level: 'department' | 'agent';
  }>;
}

function compileSkills(
  agentName: string,
  departmentSkills: Skill[],
  agentSkills: Skill[],
): CompiledSkill
```

**Conflict resolution (per CONTEXT):** Agent-level skills take precedence over department-level skills when names conflict. The compiler checks for name collisions and uses the agent-level version, noting the override in a comment.

### GitHub Import Service

Per CONTEXT decisions:
- Single file URL imports one skill
- Directory URL imports all .md files as skills
- Preview fetched content in editor before saving (single files)
- Directory imports all at once (no per-file selection)
- Track source GitHub URL on imported skills
- Public repos only for MVP (per Claude's Discretion)

Implementation:
1. Parse GitHub URL to extract owner, repo, path, and branch
2. Use GitHub raw content URL (`raw.githubusercontent.com`) for file fetch
3. For directory URLs, use GitHub API (`api.github.com/repos/{owner}/{repo}/contents/{path}`) to list files, then fetch each .md file
4. No authentication needed for public repos (MVP)
5. Rate limiting: GitHub API allows 60 requests/hour unauthenticated -- sufficient for import operations

### Template Library Architecture

Per CONTEXT: "Card grid layout showing skill name, description, and department/role tags."

Two access paths:
1. Agent page "Add from templates" button -- opens a dialog/panel filtered to relevant department
2. Standalone browse page -- full library with department and role type filters

Templates follow a copy-and-customize model:
1. Admin selects a template
2. System creates a copy in the business skill library (new `skills` row with `source_type: 'template'`)
3. Admin can edit the copy freely
4. Original template is unchanged

### Skill Editor Split-Pane

Per CONTEXT: "Split-pane editor: structured form on left, live preview on right."

Left pane (form):
- Name (text input)
- Description (text area)
- Instructions (text area -- the main skill content)
- Trigger Phrases (tag input or comma-separated)

Right pane (preview):
- Live-updating SKILL.md preview showing the compiled markdown
- Matches the frontmatter + section format established in Phase 8

The editor opens when clicking a skill from the agent's Skills tab. It is a Dialog or full-page component, not inline editing (per CONTEXT: "Click a skill to open full split-pane editor").

### Department Skill Management

Per CONTEXT: "Department skill assignment available from both department detail page and skill library page."

Department-level skills are assigned via:
1. A department detail page (currently `/businesses/[id]/departments`) -- add skill assignment UI
2. The skill library page -- when viewing a skill's usage, can assign to departments

Department-level skills show on agents with "inherited" badge and cannot be removed at the agent level. To remove an inherited skill, the admin must unassign it from the department.

### Skill Usage Tracking

Per CONTEXT: "Skill detail shows usage: 'Used by 4 agents, 2 departments' with expandable list."

This is a computed query on `skill_assignments`:
```sql
SELECT
  COUNT(DISTINCT agent_id) as agent_count,
  COUNT(DISTINCT department_id) as dept_count
FROM skill_assignments
WHERE skill_id = ?;
```

Plus an expanded list query that joins agents/departments for names.

### Library Deletion Behavior

Per CONTEXT: "Deleting a skill from library does NOT remove it from agents already assigned."

This contradicts the CASCADE delete on `skill_assignments`. The implementation should use **soft delete** on the skills table:
- Add `deleted_at timestamptz` column to skills
- "Delete" sets `deleted_at = now()` instead of hard-deleting
- Skill assignments remain (the skill content is still used)
- Library queries filter `WHERE deleted_at IS NULL`
- Agents continue to see and use the skill until explicitly unassigned

Alternatively: on delete, copy the skill content directly to assigned agents' `skill_definition` field. The soft-delete approach is simpler and preserves the skill entity for potential restoration.

**Updated approach:** Change `skills` CASCADE to SET NULL or use soft-delete. Recommend soft-delete for simplicity:

```sql
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
```

## 5. File Impact Analysis

### New Files (estimated ~20-25)

**Database migration** (~1 file):
- `packages/db/schema/035_skills_tables.sql` -- skills, skill_assignments, skill_templates tables with RLS, indexes, seed data

**`packages/core/skill/`** (new module -- ~4 files):
- `skill-types.ts` -- Skill, SkillAssignment, SkillTemplate, CompiledSkill types
- `skill-service.ts` -- CRUD operations, assignment/unassignment, library queries
- `skill-compiler.ts` -- Compiles multiple skills into deployment SKILL.md
- `github-import.ts` -- GitHub URL parsing, content fetching

**`apps/web/_actions/`** (~1 file):
- `skill-actions.ts` -- Server Actions for skill CRUD, assignment, import, template copy

**`apps/web/_components/`** (new components -- ~7-8 files):
- `skill-editor.tsx` -- Split-pane editor (form left, preview right)
- `skill-library.tsx` -- Card grid with department/role filters
- `skill-assignment-list.tsx` -- Checkbox list for agent skill assignment
- `skill-template-browser.tsx` -- Template selection dialog/panel
- `skill-usage-card.tsx` -- Shows usage stats with expandable agent/department list
- `github-import-dialog.tsx` -- GitHub URL input, preview, and import
- `department-skills-panel.tsx` -- Department-level skill assignment UI

**`apps/web/app/(dashboard)/businesses/[id]/skills/`** (~1 file):
- `page.tsx` -- Standalone skill library/browse page

### Modified Files (estimated ~12-15)

- `packages/db/schema/_combined_schema.sql` -- Append 035 migration
- `packages/core/index.ts` -- Export new skill types (client-safe)
- `packages/core/server.ts` -- Export new skill services (server-only)
- `packages/runtime/generators/openclaw-skill-md.ts` -- Update to accept multiple skills
- `packages/runtime/generators/openclaw-workspace.ts` -- Update AgentInput to include skills array
- `packages/runtime/index.ts` -- Export updated types if needed
- `packages/core/deployment/service.ts` -- Query skills per agent, pass to workspace generator
- `apps/web/_actions/deployment-actions.ts` -- Include skills in workspace generation call
- `apps/web/_components/agent-detail-tabs.tsx` -- Add "Skills" tab
- `apps/web/_components/agent-card.tsx` -- Add skill count badge
- `apps/web/_components/agents-list.tsx` -- Pass skill count to AgentCard
- `apps/web/_components/sidebar-nav.tsx` -- Add "Skills" nav item
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` -- Fetch skill assignments
- `apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx` -- Fetch skill counts
- `apps/web/app/(dashboard)/businesses/[id]/departments/page.tsx` -- Add department skill assignment UI

## 6. Plan Breakdown Strategy

### Plan 09-01: Schema, Skill Service, and Compiler
**Scope:** Database foundation + core skill management logic
- Migration 035: skills, skill_assignments, skill_templates tables with RLS and seed data (8-12 starter templates)
- Skill types in `packages/core/skill/skill-types.ts`
- Skill service: CRUD operations, assign/unassign, list by agent/department
- Skill compiler: merge multiple skills into single SKILL.md (replaces current 2-way merge)
- GitHub import service: URL parsing, public repo content fetching
- Update OpenClaw SKILL.md generator to accept multiple skills
- Update workspace generator and deployment service to query and pass skills
- Export new types and services from core barrels

**Requirements covered:** Partial SKILL-01 (backend), SKILL-02 (backend), SKILL-03 (backend)

**Files ~15-18**

### Plan 09-02: Skill Editor, Assignment UI, and Agent Skills Tab
**Scope:** Agent-level skill management UI
- Split-pane skill editor component (structured form + live preview)
- Skill assignment list with checkboxes on agent detail page
- New "Skills" tab on agent detail tabs
- Skill count badge on agent cards and agents list
- Unassign confirmation dialog
- Department-inherited skill display with "inherited" badge
- Skill detail with usage stats
- Server Actions for skill CRUD and assignment

**Requirements covered:** SKILL-01 (full), SKILL-03 (UI portion)

**Files ~12-15**

### Plan 09-03: Template Library, GitHub Import UI, and Library Page
**Scope:** Template browsing, GitHub import, and standalone library
- Skill template browser: card grid with department/role type filters
- Template preview before adding to business
- Copy-and-customize flow (template to business library)
- GitHub import dialog: URL input, content preview, import confirmation
- Directory import for multiple .md files
- Standalone skill library page at `/businesses/[id]/skills`
- Sidebar nav update with "Skills" item
- Department-level skill assignment UI (on departments page and library page)

**Requirements covered:** SKILL-02 (UI), SKILL-04 (full), SKILL-03 (department UI)

**Files ~10-12**

## 7. Requirement Coverage

| Requirement | Covered By | Implementation |
|-------------|-----------|----------------|
| SKILL-01 | Plan 09-01 + 09-02 | Split-pane editor with structured sections (name, description, instructions, triggers). Skills as first-class entities. Versioning via version column increment. |
| SKILL-02 | Plan 09-01 + 09-03 | GitHub URL parsing and content fetching (public repos). Single file and directory import. Preview before save. Source URL tracked. |
| SKILL-03 | Plan 09-01 + 09-02 + 09-03 | skill_assignments table with agent_id/department_id. Department skills inherited by all agents with "inherited" badge. Agent-level precedence on name conflict. |
| SKILL-04 | Plan 09-01 + 09-03 | skill_templates table seeded with 8-12 starter skills. Card grid with department/role filters. Copy-and-customize model. Accessible from agent page and standalone browse page. |

All 4 requirements covered across 3 plans.

## 8. Technical Considerations

### Backward Compatibility with Phase 8 Skill Data

Phase 8 stored skills in two places:
1. `agents.skill_definition` -- agent-level SKILL.md text
2. `departments.department_skill` -- department-level SKILL.md text

Phase 9 introduces the `skills` table. To maintain backward compatibility:
- Keep `agents.skill_definition` as a computed/cached field containing the compiled SKILL.md
- On first use (or via migration script), auto-create skill entities from existing text data
- The deployment pipeline switches to querying `skill_assignments` instead of the text fields
- Old text fields become read-only artifacts of Phase 8

### Versioning Strategy

Per CONTEXT: "Skills are versioned -- each edit creates a new version."

Simple approach: increment the `version` integer on each update. The `updated_at` timestamp provides the edit time. For MVP, version history is not stored (no separate versions table). The version number is a counter displayed in the UI.

If full version history is needed later, a `skill_versions` table can store snapshots. For now, the audit_logs table captures skill edit events with metadata.

### GitHub Import URL Parsing

GitHub URLs come in several formats:
- File: `https://github.com/{owner}/{repo}/blob/{branch}/{path}`
- Directory: `https://github.com/{owner}/{repo}/tree/{branch}/{path}`
- Raw: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`

The import service must:
1. Detect URL type (file vs directory)
2. Extract owner, repo, branch, and path
3. For files: fetch raw content via `raw.githubusercontent.com`
4. For directories: list contents via GitHub API, then fetch each .md file

### Skill Compilation at Deploy Time

The compiled SKILL.md for deployment combines all assigned skills:

```markdown
---
name: {Agent Name}
description: Combined skills for {Agent Name}
---

# {Agent Name} Skills

## Department Skills

### {Skill 1 Name}
{Skill 1 content}

### {Skill 2 Name}
{Skill 2 content}

## Agent Skills

### {Skill 3 Name}
{Skill 3 content}
```

Character budget remains at 4000 chars (matching existing OpenClaw generators). Skills are included in priority order: department-inherited first, then agent-specific. If total exceeds budget, later skills are truncated with a `...` marker.

### Soft Delete for Library Safety

Per CONTEXT: "Deleting a skill from library does NOT remove it from agents already assigned."

Implementation with soft delete:
- Add `deleted_at timestamptz` to `skills` table
- Library queries: `WHERE deleted_at IS NULL`
- Assignment queries: no filter on deleted_at (agents keep access)
- UI shows soft-deleted skills as "removed from library" with option to restore
- Hard delete (permanent) available as a separate admin action

### Template Seed Data

2-3 curated starter skills per department type (8-12 total):

**Owner:**
- Strategic Planning Skill (goal setting, KPI tracking, quarterly reviews)
- Team Coordination Skill (cross-department communication, meeting facilitation)

**Sales:**
- Lead Qualification Skill (ICP matching, scoring, prioritization)
- Outreach Cadence Skill (email sequences, follow-up timing, personalization)
- Deal Management Skill (pipeline tracking, forecasting, close planning)

**Support:**
- Ticket Triage Skill (classification, urgency assessment, routing)
- Knowledge Base Lookup Skill (search, answer synthesis, gap identification)

**Operations:**
- Process Automation Skill (workflow triggers, error handling, reporting)
- Data Analysis Skill (metrics collection, anomaly detection, visualization)
- Resource Scheduling Skill (calendar management, capacity planning)

Each template includes name, description, content (full SKILL.md body), department_type, role_type, and trigger_phrases.

### Skill Editor State Management

The split-pane editor is a client component with local state:
- Left pane form fields (name, description, instructions, triggers) in React state
- Right pane preview computed from form state (no server round-trip)
- Save button triggers Server Action to persist
- Version increments on save
- Unsaved changes warning on navigation

### Performance Considerations

Skill queries for the agents list page need to be efficient. Two approaches:
1. **Join query:** Fetch skill_assignments count per agent in a single query
2. **Denormalized count:** Store skill count on agents table (update on assign/unassign)

For MVP, option 1 (join query) is preferred -- simpler, no sync issues. The agents list query becomes:
```sql
SELECT agents.*,
  (SELECT COUNT(*) FROM skill_assignments WHERE agent_id = agents.id) as direct_skill_count,
  (SELECT COUNT(*) FROM skill_assignments WHERE department_id = agents.department_id) as inherited_skill_count
FROM agents WHERE business_id = ?
```

Or more practically, fetch skill_assignments separately and compute counts client-side.

## 9. Risk Assessment

### Low Risk
- **Schema design** -- Additive tables only, follows established patterns (business_id FK, RLS, CASCADE)
- **Skill service CRUD** -- Standard Supabase operations, matching existing service patterns
- **Template library** -- Static seed data, simple card grid UI
- **Sidebar nav update** -- Single line addition following existing pattern

### Medium Risk
- **GitHub import** -- External HTTP calls to GitHub API. Mitigate: timeout handling, error messages for rate limiting (60 req/hr unauthenticated), validate URL format before fetch
- **Backward compatibility** -- Transition from Phase 8's text-field model to Phase 9's entity model. Mitigate: keep old fields, auto-migrate existing data, ensure deployment pipeline works with both old and new models during transition
- **Split-pane editor** -- Most complex UI component in this phase. Mitigate: start with simple form + monospace preview (not rendered markdown), keep state management flat
- **Skill compilation for deployment** -- Multiple skills must merge cleanly without exceeding character budget. Mitigate: clear ordering rules (department first, agent second), truncation with marker, test with edge cases

### No High Risks
This phase is self-contained: new tables, new module, new UI pages. The only modifications to existing code are additive (new tab, new badge, updated deployment query). No destructive changes to existing functionality.

## RESEARCH COMPLETE
