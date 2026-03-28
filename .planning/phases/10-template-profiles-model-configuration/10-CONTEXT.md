# Phase 10: Template Profiles & Model Configuration - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Make model_profile and tool_profile properly editable with structured UI on both agent templates and live agents. Add a model dropdown for model selection (Claude models only), define tool_profile shape (MCP servers + tool allowlist), and provide per-department defaults. Currently both fields are empty JSONB blobs with no real editing UI.

</domain>

<decisions>
## Implementation Decisions

### Model Selection UX
- Model dropdown appears on BOTH the template form AND the agent config tab (agent can override template default)
- Claude models only: Opus, Sonnet, Haiku (current + latest versions)
- Friendly names only in the dropdown (e.g., "Claude Sonnet 4") — no raw model IDs visible to admin
- Model selection only for now — no temperature/max tokens/parameter editing (parameters stay in raw JSON if needed later)

### Tool Profile Structure
- tool_profile stores BOTH MCP server configs AND a tool allowlist section
- Per-department default tool profiles: Sales gets CRM tools, Support gets helpdesk tools, etc.
- MCP server connections should be tested/validated on save (ping the URL to verify reachable)

### Profile Editing Experience
- Structured form by default with a toggle to switch to raw JSON editor for power users
- Editing opens in a side panel (drawer) — click edit, slide-out panel appears, doesn't navigate away
- Save persists to DB, then prompts "Redeploy to apply changes?" since agents run on VPS
- Add tool flow: "Add Tool" or "Add MCP Server" button shows a list of known tools/MCPs, admin selects one and then configures it

### Default Values & Inheritance
- Copy on create + "Sync from template" button — agent gets a snapshot of template profiles at creation, can pull latest with sync button
- Per-department default models: Owner=Opus, Sales=Sonnet, Support=Haiku, Operations=Sonnet
- No divergence badge when agent overrides template model — just show current value
- "Sync from template" shows a diff of what will change and requires confirmation dialog before overwriting

### Claude's Discretion
- Exact list of known tools/MCPs to populate the add-tool picker
- Tool profile JSON schema shape (as long as it supports MCP configs + allowlist)
- Structured form field layout in the drawer
- How to handle the raw JSON ↔ structured form toggle (data conversion)

</decisions>

<specifics>
## Specific Ideas

- The add-tool flow should feel like a catalog: click "Add MCP Server", see a list of known servers, pick one, then fill in its specific config fields
- Per-department defaults should be meaningful stubs — not just empty objects, but actual starter configs that make sense for each department type
- Current codebase reads `model_profile.model` in three places (runtime config, deployment service, test chat) — new model dropdown must write to this same key

</specifics>

<deferred>
## Deferred Ideas

- AITMPL integration for tool/MCP catalog — Phase 15
- Temperature/max tokens/advanced model parameters UI — future enhancement
- Multi-provider model support (OpenAI, Gemini) — out of scope, Claude only

</deferred>

---

*Phase: 10-template-profiles-model-configuration*
*Context gathered: 2026-03-28*
