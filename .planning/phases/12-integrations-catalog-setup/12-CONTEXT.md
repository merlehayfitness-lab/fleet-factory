# Phase 12: Integrations Catalog & Setup - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can add integrations from a browsable catalog, assign them to specific departments or agents, and get AI-generated setup instructions. The catalog replaces the current per-agent "Add Mock" buttons with a centralized browsing and selection experience. Category auto-populates based on integration selection.

</domain>

<decisions>
## Implementation Decisions

### Catalog browsing experience
- Categorized list layout — integrations grouped under category headers (CRM, Messaging, Email, Helpdesk, Calendar)
- Opens as a dialog/modal overlay on the current integrations page
- Search bar at top to filter integrations, plus category grouping below
- Each entry shows: icon (real brand logo), name, and short description

### Assignment flow
- Single picker showing departments AND agents together — admin picks one or more targets
- Multi-assign in one step — select multiple departments/agents when adding a single integration
- Department assignment inherits down to all agents in that department
- After selecting integration and targets, integration is created immediately (no confirmation step) and AI setup instructions appear

### AI setup instructions
- Displayed in the same modal — after adding, the modal transitions to show instructions
- Generated in real-time via streaming Claude API call (not pre-generated templates)
- Instructions combine generic provider setup (API keys, webhooks, permissions) AND contextual guidance tailored to the assigned department/agent role
- Regeneratable anytime — a button on the integration card to re-show or regenerate instructions

### Catalog content
- 10-15 integrations across all 5 categories (3-4 per category) with real brand logos
- 1-2 integrations wired with real connection flows as proof of concept, rest use mock adapters
- All integrations appear available — no "coming soon" badges, mock ones work with mock data

### Claude's Discretion
- Which 1-2 integrations to wire with real connections (pick based on effort vs demo value)
- Exact search/filter implementation details
- How to source and display real brand logos (SVGs, CDN, bundled assets)
- Loading/streaming UI for AI instruction generation
- How to visually distinguish department vs agent targets in the picker

</decisions>

<specifics>
## Specific Ideas

- Existing integration system uses 5 types: crm, email, helpdesk, calendar, messaging — catalog should map to these
- Current schema has unique constraint on (business_id, agent_id, type) — department-level assignment will need schema consideration
- Mock adapters already exist for all 5 types — catalog should leverage existing adapter pattern
- AI instructions should feel like a knowledgeable setup guide, not a generic help doc

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-integrations-catalog-setup*
*Context gathered: 2026-03-29*
