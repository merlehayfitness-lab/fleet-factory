# Phase 9: Skill Management & Deployment - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can create, edit, import, and assign skills to agents and departments through a dedicated skill management interface. Skills are SKILL.md files that get routed to specific agents on the VPS. This phase covers the editor, GitHub import, assignment/inheritance model, and curated template library.

</domain>

<decisions>
## Implementation Decisions

### Skill Editor Experience
- Split-pane editor: structured form on left, live preview on right
- Core fields only for MVP: name, description, instructions, trigger phrases
- Editor lives inside the agent detail page (not a standalone route)
- Creating a new skill always offers templates first, with option to skip to blank
- Skills are always live once saved — no draft/active states (SKILL.md routes directly to agent on VPS)
- Skills are versioned — each edit creates a new version
- Skills are strictly per-tenant — no cross-business sharing (templates are the shared source)
- Click a skill to open full split-pane editor (no inline editing)

### GitHub Import Flow
- Admin pastes a GitHub URL (file or directory)
- Single file URL imports one skill; directory URL imports all .md files as skills
- Preview fetched content in the editor before saving (for single files)
- Directory imports all at once (no per-file selection)
- Imported skill auto-assigns to the current agent AND adds to business skill library
- Skills in library can be assigned to other agents manually
- Deleting a skill from library does NOT remove it from agents already assigned
- Track source GitHub URL on imported skills for potential re-sync later

### Assignment & Inheritance
- Skill list with checkboxes on agent detail page — check to assign, uncheck to remove
- Department-level skills show on agents with "inherited" badge — cannot be removed at agent level
- Department skill assignment available from both department detail page and skill library page
- Agent-level skills take precedence over department-level skills when names conflict
- Skill count badge shown on agents list page (e.g., "3 skills")
- Unassigning a skill requires confirmation dialog
- Skill detail shows usage: "Used by 4 agents, 2 departments" with expandable list

### Template Library
- Card grid layout showing skill name, description, and department/role tags
- Filterable by both department (Sales, Support, Operations, Owner) and role type (outreach, scheduling, analysis, customer-facing)
- Accessible from two paths: agent page ("Add from templates") and standalone browse page
- Templates create a copy in business library — fully editable (copy-and-customize model)
- Preview template content before adding to business
- 2-3 curated starter skills per default department (Sales, Support, Operations, Owner)
- Templates stored in database, seeded on setup (not static files)
- System-managed only — business admins cannot contribute skills back to template library

### Claude's Discretion
- Preview pane rendering style (rendered markdown vs raw)
- GitHub import: public repos only for MVP vs supporting private repos
- Conflict resolution when importing a skill with same name as existing
- Exact starter template content for each department
- Specific role type categories for template filtering

</decisions>

<specifics>
## Specific Ideas

- Skills route directly to agents on the VPS as SKILL.md files — this is not just metadata, it's the actual runtime artifact
- Library deletion behavior: soft-delete from library but agents keep their assigned copy — important for operational safety
- GitHub URL tracking enables a "re-import" or "check for updates" flow in the future
- Template library should feel like a curated app store for skills, not a dump of files

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-skill-management-deployment*
*Context gathered: 2026-03-28*
