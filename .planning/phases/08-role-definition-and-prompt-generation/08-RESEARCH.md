# Phase 8: Role Definition & Prompt Generation -- Research

**Researched:** 2026-03-27
**Phase Goal:** Admin describes agent roles in plain language, Claude generates production-quality system prompts AND SKILL.md files, departments support multiple agents with parent-child hierarchy, and an updated setup wizard includes knowledge upload.

## 1. Existing Code That Must Change

### Agent Config Tab (`apps/web/_components/agent-config.tsx`)

Currently a single Card with a plain textarea for the system prompt (editable), plus read-only cards for Template Reference, Template Differences, Tool Profile, and Model Profile. Phase 8 must add:
- **Role Definition card** (new) -- structured fields: plain-language description, tone selector, focus areas, workflow instructions
- **SKILL.md card** (new) -- displays generated SKILL.md with edit capability
- **Generate button** linking Role Definition to System Prompt + SKILL.md generation
- **Side-by-side refinement panel** with chat input on left, live prompt preview on right, diff highlighting
- **Test chat** button that opens inline chat using draft prompt

The existing System Prompt card stays but gains a "Generate from Role Definition" action and section-based editing (Identity, Instructions, Tools, Constraints).

### Agent Detail Tabs (`apps/web/_components/agent-detail-tabs.tsx`)

Currently 6 tabs: Overview, Config, Activity, Conversations, Integrations, Knowledge. The Config tab will be significantly expanded but no new tabs are needed. The agent data interface must be extended with `role`, `parent_agent_id`, `skill_definition`, and `role_definition` fields.

### Agent Detail Page (`apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx`)

Server component that fetches agent with `departments(id, name, type)` and `agent_templates(...)` joins. Must be extended to:
- Fetch parent agent (if sub-agent) and child agents (if lead)
- Pass new fields to AgentDetailTabs
- Show parent/child relationship in header

### Agents List Page (`apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx`)

Currently a flat list of agents grouped by nothing. Must show hierarchy:
- Lead agents at top level
- Sub-agents indented under their lead
- Role displayed next to agent name
- Department grouping with agent count

### Agent Service (`packages/core/agent/service.ts`)

`updateAgentConfig()` currently accepts `system_prompt`, `tool_profile`, `model_profile`. Must be extended to also accept:
- `role_definition` (jsonb -- structured role definition fields)
- `skill_definition` (text -- generated SKILL.md content)
- `role` (text -- agent's role within department)
- `parent_agent_id` (uuid -- parent agent reference)

### Agent Lifecycle (`packages/core/agent/lifecycle.ts`)

Status machine currently: provisioning -> active -> paused/frozen/error -> retired. No changes needed to transitions, but the `provisioning` status gains new meaning in the wizard flow (agent created with status 'provisioning' at wizard Step 2 for knowledge upload FK, finalized to 'active' at wizard completion).

### Deployment Service (`packages/core/deployment/service.ts`)

Lines 294-323 generate OpenClaw workspace via `generateOpenClawWorkspace()`. Must be extended to:
- Include `skill_definition` in the workspace package (new SKILL.md file per agent)
- Include `department_skill` from departments table (department-level SKILL.md)
- Pass role and hierarchy metadata to generators

### OpenClaw Workspace Generator (`packages/runtime/generators/openclaw-workspace.ts`)

Currently generates 5 files per agent: AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md, USER.md. Must add:
- SKILL.md file per agent (from `agent.skill_definition`)
- Department-level skill inheritance (merge department_skill + agent skill_definition)

### Provision RPC (`packages/db/schema/010_provision_rpc.sql`)

Currently creates agents from templates with template's system_prompt. New agents created via wizard will bypass this flow (wizard creates agents individually with status 'provisioning'). The RPC itself does not need changes -- it handles business provisioning with default starter agents. The new wizard is for adding additional agents to existing businesses.

### Database Schema

**`agents` table (006_agents.sql)** -- needs 4 new nullable columns:
- `role` text (e.g., "CEO", "Paid Ads Specialist", "HR Lead")
- `parent_agent_id` uuid (self-referencing FK, nullable)
- `skill_definition` text (SKILL.md content, nullable)
- `role_definition` jsonb (structured role inputs, nullable)

**`departments` table (004_departments.sql)** -- needs 1 new column:
- `department_skill` text (department-level SKILL.md, nullable)

### Core Types (`packages/core/types/index.ts`)

No new status types needed. Existing `AgentStatus` already includes 'provisioning' which serves the provisional agent pattern.

## 2. New Dependencies Required

### Anthropic SDK

The project currently uses `openai` package (v6.33.0) for embeddings only. Phase 8 needs the **Anthropic SDK** (`@anthropic-ai/sdk`) for:
- System prompt generation from role definition
- SKILL.md generation from role definition
- Chat-like refinement (iterative prompt editing)
- Test chat (running draft prompts against Claude)
- Structured breakdown parsing (showing admin what Claude understood)

**Installation:** `pnpm add @anthropic-ai/sdk` in `packages/core`

**Environment variable:** `ANTHROPIC_API_KEY` -- accessed via helper function following existing pattern (see `packages/core/knowledge/embedder.ts` for the OpenAI pattern).

**Model choice:** Claude Sonnet for generation (fast, cost-effective for prompt generation). Claude Opus only if admin explicitly selects it for test chat using agent's configured model.

### No Other New Dependencies

- No new UI component libraries needed -- existing shadcn/ui components cover all needs
- No diff library needed -- simple string comparison with line-by-line diff is sufficient for MVP
- No markdown parser needed -- SKILL.md stored and displayed as plain text

## 3. Schema Changes Needed

### Migration 033: Agent role and hierarchy columns

```sql
-- 033_agent_role_hierarchy.sql
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_definition text,
  ADD COLUMN IF NOT EXISTS role_definition jsonb;

CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id
  ON public.agents (parent_agent_id);
```

### Migration 034: Department skill column

```sql
-- 034_department_skill.sql
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS department_skill text;
```

All columns are nullable and additive -- no breaking changes to existing data or queries.

## 4. Architecture Decisions

### Claude Prompt Generator Service

New module: `packages/core/prompt-generator/`

```
packages/core/prompt-generator/
  generator-service.ts    -- orchestrates generation (prompt + SKILL.md)
  generator-types.ts      -- input/output types for generation
  prompt-templates.ts     -- meta-prompts that instruct Claude how to generate
  refinement-service.ts   -- handles iterative refinement requests
  test-chat-service.ts    -- runs test conversations with draft prompts
```

**Generation flow:**
1. Admin fills role definition fields (description, tone, focus, workflow)
2. Admin selects which knowledge docs and integrations to reference (suggestion UI with checkboxes)
3. Client sends structured input to Server Action
4. Server Action calls `generatePromptAndSkill()` in generator-service
5. Claude receives a meta-prompt with the role definition and returns structured output
6. Server returns { systemPrompt (sectioned), skillDefinition, structuredBreakdown }
7. Client shows breakdown for confirmation, then shows generated prompt + SKILL.md in preview

**Meta-prompt structure:** The meta-prompt instructs Claude to output a structured system prompt with 4 labeled sections (Identity, Instructions, Tools, Constraints) plus a SKILL.md with scoped capabilities. The meta-prompt includes context about the business, department, and any referenced knowledge docs.

### Role Definition Data Model

```typescript
interface RoleDefinition {
  description: string;        // Plain-language role description
  tone: string;               // e.g., "professional", "friendly", "formal"
  focus_areas: string[];      // Key responsibilities
  workflow_instructions: string; // Free-text workflow (Claude parses structure)
  linked_integrations: string[]; // Integration IDs referenced in role
  linked_knowledge_docs: string[]; // Knowledge doc IDs to reference
  template_id?: string;       // If started from a curated template
}
```

Stored as JSONB on agents.role_definition. This is the input that drives generation.

### Refinement Flow

Chat-like refinement uses the same Anthropic SDK:
1. Admin types refinement request (e.g., "make it more formal")
2. Server Action sends current prompt + refinement request to Claude
3. Claude returns updated prompt
4. Client shows diff (added/removed lines) before admin accepts
5. On accept, prompt state updates; on reject, reverts

Conversation history for refinement is kept in client state (not persisted) -- it is ephemeral to the editing session.

### Side-by-Side Panel Architecture

The refinement UI is the most complex component. Architecture:
- **Left panel:** Chat input with message history (refinement requests + Claude responses)
- **Right panel:** Live prompt preview with 4 collapsible sections (Identity, Instructions, Tools, Constraints)
- **Diff overlay:** When a refinement arrives, right panel highlights changes with green (added) / red (removed) line styling
- **Accept/Reject buttons:** Below the diff to confirm or revert

This is a client-side component (`"use client"`) with local state for chat history and prompt versions. Server Actions handle the Claude API calls.

### Test Chat Architecture

"Test this prompt" opens a Dialog with:
- The draft system prompt loaded as the agent's system prompt
- A simple chat interface (reuse existing chat UI patterns from Phase 5)
- Messages sent to Claude via Anthropic SDK with the draft prompt as system message
- Full back-and-forth conversation (not single response)
- Model selection follows agent's configured model_profile

Server Action: `testPromptAction(systemPrompt, messages, modelProfile)` -> streams response back.

### Multi-Agent Department Hierarchy

**Data model is simple:** nullable `parent_agent_id` FK + `role` text field on agents table.

**Rules:**
- First agent in a department with `parent_agent_id IS NULL` is the lead
- New agents in same department get `parent_agent_id` set to the lead's ID
- If no lead exists, the new agent becomes the lead
- Role field is free-text (admin types it in wizard Step 1)

**Skill inheritance:** When deploying, the effective SKILL.md for an agent is:
1. Start with department's `department_skill` (if set)
2. Merge/override with agent's `skill_definition` (if set)
3. The generator handles this merge in `packages/runtime/generators/`

### Wizard Architecture

New route: `/businesses/[id]/agents/new` with a multi-step wizard component.

**Steps:**
1. **Basic Info** -- Name, department selector (shows existing agent count), role field
2. **Knowledge Upload** -- Agent-specific document upload (reuses Knowledge Base upload components from Phase 7). Blocks until processing complete. Creates agent with status 'provisioning' to have an agent_id for knowledge FK.
3. **Role Definition** -- Structured fields with guided prompts. Template selector (pick from curated templates per department type). Claude parses workflow instructions and shows structured breakdown for confirmation.
4. **Prompt Generation** -- Claude generates system prompt + SKILL.md. Side-by-side refinement panel. Test chat button. Context suggestion UI (knowledge docs, integrations).
5. **Review** -- Full summary: role definition, system prompt (collapsible sections), SKILL.md preview, linked knowledge docs with status, connected integrations. Single "Create Agent" button finalizes agent to 'active'.

**Provisional agent pattern:** At Step 2 entry, a Server Action creates the agent record with `status: 'provisioning'` and minimal fields (name, department_id, business_id, template_id). This gives us an `agent_id` for knowledge document uploads. If the wizard is abandoned, a cleanup job or manual deletion handles orphaned provisioning agents.

### Template Library

Curated templates seeded per department type. Stored in a new `role_templates` table or as a static JSON file in `packages/core/prompt-generator/templates/`. For MVP, a static JSON file is simpler (no migration needed, easy to update).

Template structure:
```typescript
interface RoleTemplate {
  id: string;
  name: string;             // e.g., "Outbound Sales Rep"
  departmentType: string;   // e.g., "sales"
  description: string;
  roleDefinition: RoleDefinition; // Pre-filled fields
  suggestedIntegrations: string[]; // e.g., ["crm", "email"]
}
```

Admin picks a template, fields pre-fill, admin customizes, then proceeds to generation.

## 5. File Impact Analysis

### New Files (estimated ~25-30)

**`packages/core/prompt-generator/`** (new module -- ~5 files):
- `generator-service.ts` -- Claude API calls for prompt + SKILL.md generation
- `generator-types.ts` -- RoleDefinition, GenerationResult, RefinementRequest types
- `prompt-templates.ts` -- meta-prompts for Claude (generation, refinement, breakdown)
- `refinement-service.ts` -- iterative refinement with diff tracking
- `test-chat-service.ts` -- test chat with draft prompts

**`packages/core/prompt-generator/templates/`** (~1 file):
- `role-templates.ts` -- curated template library (static data)

**`packages/runtime/generators/`** (~1 new file):
- `openclaw-skill-md.ts` -- SKILL.md generator with department/agent merge

**`packages/db/schema/`** (~2 files):
- `033_agent_role_hierarchy.sql`
- `034_department_skill.sql`

**`apps/web/_components/`** (new components -- ~8 files):
- `role-definition-card.tsx` -- structured role definition form
- `skill-definition-card.tsx` -- SKILL.md display/edit card
- `prompt-refinement-panel.tsx` -- side-by-side refinement UI
- `prompt-diff-viewer.tsx` -- line-by-line diff display
- `test-chat-dialog.tsx` -- test chat in dialog
- `agent-setup-wizard.tsx` -- multi-step agent creation wizard
- `wizard-knowledge-step.tsx` -- knowledge upload step (reuses existing components)
- `context-suggestion-ui.tsx` -- checkbox UI for knowledge/integration selection

**`apps/web/_actions/`** (~2 files):
- `prompt-generator-actions.ts` -- Server Actions for generation, refinement, test chat
- `agent-wizard-actions.ts` -- Server Actions for wizard steps (create provisional agent, finalize)

**`apps/web/app/(dashboard)/businesses/[id]/agents/new/`** (~1 file):
- `page.tsx` -- wizard route page

### Modified Files (estimated ~12-15)

- `packages/core/agent/service.ts` -- extend updateAgentConfig with new fields
- `packages/core/index.ts` -- export new types and services
- `packages/core/server.ts` -- export new server-only services
- `packages/core/package.json` -- add @anthropic-ai/sdk dependency
- `packages/core/types/index.ts` -- no new types needed (possibly add RoleDefinition re-export)
- `packages/runtime/generators/openclaw-workspace.ts` -- add SKILL.md generation
- `packages/runtime/index.ts` -- export new generator
- `packages/core/deployment/service.ts` -- include skill_definition in workspace generation
- `apps/web/_components/agent-config.tsx` -- add Role Definition + SKILL.md cards, rewire System Prompt card
- `apps/web/_components/agent-detail-tabs.tsx` -- extend Agent interface, pass new props to Config
- `apps/web/_components/agents-list.tsx` -- show hierarchy (lead/sub-agent indentation, role badges)
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` -- fetch hierarchy data
- `apps/web/app/(dashboard)/businesses/[id]/agents/page.tsx` -- add "New Agent" button, hierarchy display

## 6. Plan Breakdown Strategy

### Plan 08-01: Role Definition Card, Claude Prompt Generator, and Config Tab UI
**Scope:** Core generation infrastructure + Config tab UI additions
- Schema migration: add role_definition, skill_definition columns to agents
- Anthropic SDK integration: `packages/core/prompt-generator/` module
- Meta-prompts for generation (system prompt + SKILL.md from role definition)
- Role Definition card component (structured fields, tone, focus, workflow)
- SKILL.md card component (display, edit)
- Generate button connecting Role Definition -> Claude -> System Prompt + SKILL.md
- Structured breakdown confirmation UI
- Side-by-side refinement panel with diff view
- Test chat dialog
- Context suggestion UI (knowledge docs, integrations checkboxes)
- Server Actions for generation, refinement, test chat
- Updated Config tab layout with all cards working together

**Requirements covered:** ROLE-01, ROLE-02, ROLE-03

**Files ~20-22** -- This is the largest plan (generation service + refinement UI + test chat)

### Plan 08-02: Multi-Agent Departments (Parent-Child Hierarchy, Role Field, UI Updates)
**Scope:** Schema + data model + UI for department hierarchy
- Schema migration: add parent_agent_id FK, role field to agents; department_skill to departments
- Update agent service to handle parent/child relationships
- Agents list UI: hierarchy display (lead at top, sub-agents indented, role badges)
- Agent detail page: show parent/children relationships
- Department-level skill storage and display
- SKILL.md generator with department/agent merge logic
- Deployment service updated to include SKILL.md in OpenClaw workspace

**Requirements covered:** ROLE-05, ROLE-06

**Files ~12-15**

### Plan 08-03: Agent Setup Wizard with Knowledge Upload, SKILL.md Generation, and Sub-Agent Support
**Scope:** Multi-step wizard for creating new agents
- New route: `/businesses/[id]/agents/new`
- Wizard component with 5 steps (Basic Info, Knowledge Upload, Role Definition, Prompt Generation, Review)
- Provisional agent pattern (create with 'provisioning' status at Step 2)
- Knowledge upload step (reuse Phase 7 upload components, agent-specific zone)
- Processing progress per document with blocking until ready
- Role template library (curated templates per department type)
- Department selector showing existing agent count
- Sub-agent support (if department has lead, new agent becomes sub-agent)
- Review step with full summary and single "Create Agent" button
- Server Actions for wizard flow

**Requirements covered:** ROLE-04

**Files ~8-10**

## 7. Technical Considerations

### Anthropic SDK Integration Pattern

Follow the existing OpenAI pattern in `packages/core/knowledge/embedder.ts`:
- Helper function `getAnthropicApiKey()` that throws if `ANTHROPIC_API_KEY` is missing
- Factory function `getAnthropicClient()` that creates client instance
- Graceful fallback if key not set (return error message, don't crash)
- All calls wrapped in try/catch with descriptive error messages

### Meta-Prompt Design (Critical)

The quality of generated system prompts depends entirely on the meta-prompt. Key considerations:
- Meta-prompt must include business context (name, industry, department type)
- Meta-prompt must specify the 4-section output format (Identity, Instructions, Tools, Constraints)
- Meta-prompt must instruct Claude to generate SKILL.md alongside system prompt
- Meta-prompt must reference any knowledge docs the admin selected
- Meta-prompt must reference any integrations the admin linked
- Use structured output (JSON) for the generation response to reliably parse sections

**Recommended approach:** Use Claude's system prompt to define the meta-prompt, and the user message to pass the role definition inputs. Response should be structured JSON with separate fields for each section.

### Side-by-Side Refinement Complexity

This is the most complex UI component. Simplification strategies:
- Use a simple line-by-line diff (split by newlines, compare) rather than a full diff algorithm
- Keep refinement history in React state (not persisted)
- Limit visible diff to the changed section only (not the entire prompt)
- Use green/red background highlighting for added/removed lines
- Mobile fallback: stacked layout (chat on top, preview below) instead of side-by-side

### Provisional Agent Cleanup

Agents created with status 'provisioning' during wizard but never finalized:
- Option A: Cron job that deletes agents with status 'provisioning' older than 24 hours
- Option B: Manual cleanup -- admin sees provisioning agents and can delete them
- **Recommended: Option B for MVP** -- simpler, no background job infrastructure needed. Provisioning agents are visible in the agents list with a "Provisioning" badge and can be deleted.

### Template Library as Static Data

Using a static TypeScript file instead of a database table for MVP:
- Faster to iterate (no migrations for template changes)
- Versioned in git (easy to review template quality)
- Can be promoted to database table in Phase 9 if needed
- Templates are read-only for admins (they customize after selecting, don't edit templates themselves)

### Streaming Responses

For test chat and refinement, Claude responses should stream for better UX:
- Anthropic SDK supports streaming via `client.messages.stream()`
- Server Action can return a ReadableStream
- Client component progressively renders tokens as they arrive
- For generation (not streaming), use regular `client.messages.create()` since we need the full structured response

**MVP simplification:** Start without streaming. Use loading spinner during generation. Add streaming in a follow-up if latency is noticeable.

### Knowledge Doc References in Generation

When generating prompts, Claude needs to know what knowledge the agent has access to. The flow:
1. Fetch knowledge documents for the agent (agent-specific) and business (global)
2. Show them in the suggestion UI with checkboxes (pre-checked based on Claude's recommendation)
3. For checked docs, include document titles and short summaries in the meta-prompt
4. Do NOT include full document content (too large) -- just titles and descriptions
5. Claude uses this context to reference appropriate knowledge in the generated prompt

### SKILL.md Format

Based on OpenClaw conventions and the existing SKILL.md patterns in `.claude/skills/`:
```markdown
---
name: Agent Skill Name
description: Brief description of capabilities
---

# Skill Name

## Capabilities
- Capability 1
- Capability 2

## Tools
- Tool 1: When and how to use it
- Tool 2: When and how to use it

## Task Boundaries
- Can do: X, Y, Z
- Cannot do: A, B, C

## Workflows
### Workflow 1
1. Step 1
2. Step 2
```

## 8. Requirement Coverage

| Requirement | Covered By | Implementation |
|-------------|-----------|----------------|
| ROLE-01 | Plan 08-01 | Role Definition card with structured fields (description, tone, focus, workflow) |
| ROLE-02 | Plan 08-01 | Claude generates system prompt (4 sections) + SKILL.md via Anthropic SDK |
| ROLE-03 | Plan 08-01 | System Prompt card shows generated preview, refinement panel, diff view, test chat |
| ROLE-04 | Plan 08-03 | 5-step wizard: Basic Info -> Knowledge Upload -> Role Definition -> Generation -> Review |
| ROLE-05 | Plan 08-02 | parent_agent_id FK, role field, hierarchy UI in agent list and detail |
| ROLE-06 | Plan 08-02 | skill_definition stored on agents, SKILL.md generator, deployment pipeline inclusion |

All 6 requirements covered across 3 plans.

## 9. Risk Assessment

### High Risk
- **Side-by-side refinement panel complexity** -- Most complex UI component in the entire project. Multiple interactive elements (chat input, live preview, diff overlay, accept/reject). Mitigate by keeping the diff simple (line-by-line, not word-level) and starting without streaming.
- **Meta-prompt quality** -- Generated system prompts are only as good as the meta-prompt that instructs Claude. Poor meta-prompts produce poor agent prompts. Mitigate by iterating on meta-prompt design with real examples before building UI.

### Medium Risk
- **Anthropic SDK integration** -- First direct Claude API integration in the codebase (OpenAI is used for embeddings only). Need to handle rate limits, errors, and streaming correctly. Mitigate by following the established OpenAI pattern and wrapping in try/catch.
- **Wizard state management** -- 5-step wizard with provisional agent creation, file uploads, and Claude generation is complex client-side state. Mitigate by keeping state in a single parent component (wizard) and passing down via props.
- **Provisional agent cleanup** -- Abandoned wizard runs leave orphaned agents with status 'provisioning'. Mitigate by making them visible and deletable in the agents list.

### Low Risk
- **Schema changes** -- All additive nullable columns, no breaking changes.
- **Multi-agent hierarchy** -- Simple nullable FK pattern, well-understood data model.
- **Knowledge upload in wizard** -- Reuses existing Phase 7 components and Server Actions.
- **SKILL.md storage and deployment** -- Simple text field, same pattern as system_prompt.

## RESEARCH COMPLETE
