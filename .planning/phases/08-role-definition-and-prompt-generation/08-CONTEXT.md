---
status: complete
phase: 08-role-definition-and-prompt-generation
created: 2026-03-27
updated: 2026-03-27
---

# Phase 8 Context: Role Definition, Prompt Generation, SKILL.md, Multi-Agent Departments

## Phase Goal (Expanded)
Admin describes agent roles in plain language, Claude generates production-quality system prompts AND SKILL.md files, with an updated setup wizard that includes knowledge upload. Departments support multiple agents (sub-agents) with parent-child hierarchy.

## Decisions

### 1. Role Definition Inputs

**Approach**: Structured fields with guided prompts (hybrid), plus MCP server linking for tool-based workflows.

**How admins describe roles**:
- NOT a single text box. Structured fields with guided prompts per field.
- Admin writes free-text workflow instructions. Claude parses the structure (steps, tools, conditional logic) automatically.
- Examples of workflow complexity: multi-step sequences like "Search Apollo -> Enrich via Web Search -> Draft email via Gmail -> Log to Sheets", with conditional logic, segmentation rules, and monitoring.

**MCP server integration**:
- Role definition references integrations from the Integrations tab (Link model).
- Per-step tool/scope overrides allowed in the role definition (e.g., "use Apollo MCP but only the contact search tool").
- Connection config stays in Integrations tab; role definition controls how/when tools are used.

**Templates**:
- Curated template library per department type (e.g., "Outbound Sales Rep", "Support Triage Agent").
- Admin picks a template, customizes fields, links their own MCP servers.
- Templates ship with pre-filled role definitions and suggested integrations.

**Parsed breakdown**:
- After admin writes free-text, Claude ALWAYS shows a structured breakdown ("Here's what I understood: Step 1..., Step 2...") for confirmation before generating the system prompt.
- Admin can correct the breakdown before proceeding.

### 2. Prompt Generation Flow

**Output format**: Structured prompt with labeled sections:
- `## Identity` -- who the agent is
- `## Instructions` -- step-by-step workflow
- `## Tools` -- available tools and when to use them
- `## Constraints` -- boundaries, tone, forbidden actions

**Variation strategy**: One prompt generated, refined iteratively.
- Chat-like refinement: admin says "make it more formal", "add error handling for bounced emails", etc.
- Claude updates the prompt in-place based on refinement requests.

**Context inclusion**: Claude suggests which knowledge docs and MCP tools to reference in the prompt. Admin checks/unchecks before generation.
- Not auto-included (too noisy).
- Not manual-only (admin might forget).
- Suggestion UI with checkboxes.

**Sync behavior**: Role definition and system prompt are independent after initial generation.
- Changing the role definition later does NOT auto-regenerate the prompt.
- Admin must explicitly regenerate if they want changes reflected.
- This prevents accidental overwrites of manual prompt edits.

### 3. Preview & Edit Experience

**Editor type**: Plain textarea per section.
- No rich text, no markdown editor. System prompts are plain text.
- Each structured section (Identity, Instructions, Tools, Constraints) gets its own textarea.

**Refinement UI**: Side-by-side panel.
- Chat input panel on the left.
- Live prompt preview on the right, updating as Claude refines.
- Changes highlighted as diffs.

**Diff view**: Always show diff.
- Every refinement or regeneration shows added/removed lines before admin accepts.
- Prevents surprise changes to carefully edited prompts.

**Test mode**: Inline test chat.
- "Test this prompt" button opens a chat interface using the draft prompt.
- Admin can send messages and see how the agent would respond.
- Full back-and-forth conversation, not just a single response preview.
- Uses the actual model the agent is configured for.

### 4. Wizard Knowledge Step

**Step order**: Knowledge upload BEFORE role definition.
- Upload knowledge first so Claude can reference uploaded docs when generating the prompt.
- Flow: Basic Info -> Knowledge Upload -> Role Definition -> Prompt Generation -> Review

**Global docs**: NOT shown in wizard.
- Wizard only handles agent-specific uploads.
- Global business-wide docs are managed on the Knowledge Base page.
- This keeps the wizard focused and avoids overwhelming new users.

**Processing**: Block until ready.
- Admin must wait for all uploads to finish processing (chunking + embedding) before proceeding.
- Shows processing progress per document.
- Ensures knowledge is actually available when Claude generates the prompt in the next step.

**Review step**: Full summary review at the end.
- Final wizard step shows everything together:
  - Role definition summary
  - Generated system prompt (collapsible sections)
  - Generated SKILL.md preview
  - Linked knowledge documents with status
  - Connected integrations
- Single "Create Agent" button to save everything.

### 5. SKILL.md Generation (NEW)

**When generated**: During prompt generation step (Step 4 of wizard, or from Config tab).
- When Claude generates the system prompt, it ALSO generates a SKILL.md file.
- SKILL.md defines the agent's scoped capabilities, tools, and task boundaries.

**Storage**: `skill_definition` text field on the agents table (nullable).
- Stored alongside system_prompt.
- Deployed to VPS as part of agent workspace artifacts.

**Scope levels**: Both department-level and agent-level skills.
- Department defines baseline skills (all Sales agents can do X).
- Agent-level skills add specialization (this Sales agent focuses on Paid Ads).
- Agent skills override department skills if they conflict.
- Department-level skill stored on a new `department_skill` text field on departments table.

**Deployment target**: Tenant VPS (not master admin).
- SKILL.md files are pushed alongside AGENTS.md and SOUL.md during deployment.
- Each agent container gets its own SKILL.md files in its workspace directory.

### 6. Multi-Agent Departments (NEW)

**Data model**: Parent-child hierarchy on agents table.
- Add `parent_agent_id` FK (nullable, self-referencing) to agents table.
- Add `role` text field to agents table (e.g., "CEO", "Paid Ads", "HR").
- First agent in a department is the lead (parent_agent_id IS NULL).
- Subsequent agents are sub-agents (parent_agent_id references the lead).

**Wizard support**: The agent setup wizard creates agents within departments that may already have agents.
- Department selector shows existing agents count.
- If department already has a lead agent, new agent becomes a sub-agent.
- Role field in Basic Info step (Step 1).

**Agent list UI**: Show hierarchy.
- Lead agents shown at top level.
- Sub-agents indented under their lead.
- Role displayed next to agent name.

**Agent detail**: Show parent/children relationships.
- Lead agent detail page shows its sub-agents.
- Sub-agent detail page shows its parent.

## Deferred Ideas
- **Custom department selection during business provisioning** -- v2 (Theme A: Client-Facing Portal). Current MVP keeps 4 default departments.
- **Skill builder UI / editor** -- Phase 9 (new phase for skill management).
- **GitHub repo import for skills** -- Phase 9.
- **Skill template marketplace** -- Phase 9.

## Implementation Notes
- The test chat feature requires calling the actual Claude API with the draft prompt -- needs the Anthropic SDK.
- Template library needs seed data per department type (Owner, Sales, Support, Operations).
- Side-by-side refinement panel is the most complex UI component in this phase.
- SKILL.md generation reuses the same Anthropic SDK integration as prompt generation.
- Parent-child agent hierarchy is additive (nullable FK, nullable role field) -- no breaking changes to existing agents.
- Provisional agent pattern: wizard creates agent with status 'provisioning' at Step 2 entry for knowledge upload FK. Finalized to 'active' at Step 5.
