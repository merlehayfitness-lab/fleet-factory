---
phase: 08-role-definition-and-prompt-generation
plan: 01
subsystem: ai, ui
tags: [anthropic, claude, prompt-generation, refinement, test-chat, role-definition, skill-md]

# Dependency graph
requires:
  - phase: 07-rag-knowledge-base
    provides: knowledge documents for context suggestion UI
  - phase: 03-deployment-pipeline
    provides: agent config update patterns, integration infrastructure
provides:
  - Anthropic SDK integration with Claude-powered prompt generation
  - Prompt generator module (generation, refinement, test chat services)
  - Role Definition card with structured input fields
  - SKILL.md card with display and inline edit
  - Side-by-side refinement panel with diff preview
  - Test chat dialog for draft prompt validation
  - Context suggestion UI for knowledge docs and integrations
  - Section-based system prompt display (Identity, Instructions, Tools, Constraints)
  - Schema columns role_definition (jsonb) and skill_definition (text) on agents
affects: [08-02, 08-03]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk"]
  patterns: ["Meta-prompt pattern for structured JSON output", "Section-based prompt architecture (4 sections)", "Side-by-side refinement with diff tracking"]

key-files:
  created:
    - packages/db/schema/033_agent_role_hierarchy.sql
    - packages/core/prompt-generator/generator-types.ts
    - packages/core/prompt-generator/prompt-templates.ts
    - packages/core/prompt-generator/generator-service.ts
    - packages/core/prompt-generator/refinement-service.ts
    - packages/core/prompt-generator/test-chat-service.ts
    - apps/web/_actions/prompt-generator-actions.ts
    - apps/web/_components/role-definition-card.tsx
    - apps/web/_components/skill-definition-card.tsx
    - apps/web/_components/prompt-refinement-panel.tsx
    - apps/web/_components/prompt-diff-viewer.tsx
    - apps/web/_components/test-chat-dialog.tsx
    - apps/web/_components/context-suggestion-ui.tsx
  modified:
    - packages/db/schema/_combined_schema.sql
    - packages/core/index.ts
    - packages/core/server.ts
    - packages/core/package.json
    - packages/core/agent/service.ts
    - apps/web/_components/agent-config.tsx
    - apps/web/_components/agent-detail-tabs.tsx
    - apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx

key-decisions:
  - "Meta-prompts instruct Claude to output structured JSON with separate fields for each prompt section and SKILL.md"
  - "Used claude-sonnet-4-20250514 model for all generation, refinement, and test chat operations"
  - "DialogTrigger uses inline styled span instead of asChild prop (base-ui does not support asChild)"
  - "Department type extracted from agents join with unknown-first cast to handle array/object ambiguity"

patterns-established:
  - "Anthropic SDK pattern: getAnthropicApiKey() + getAnthropicClient() mirroring OpenAI embedder pattern"
  - "Prompt section architecture: Identity, Instructions, Tools, Constraints as separate fields"
  - "Refinement conversation: chat history passed with each refinement request for context continuity"

requirements-completed: [ROLE-01, ROLE-02, ROLE-03]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 8 Plan 1: Role Definition & Prompt Generation Summary

**Claude-powered prompt generation from structured role definitions with 4-section output, side-by-side refinement panel, and test chat dialog via Anthropic SDK**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T02:06:52Z
- **Completed:** 2026-03-28T02:14:52Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Schema migration adds role_definition (jsonb), skill_definition (text), role, and parent_agent_id columns to agents table
- Full prompt generator module: meta-prompt templates, generation service, refinement service, and test chat service using Anthropic SDK
- Role Definition card with structured fields (description, tone selector, focus areas, workflow instructions) and Generate button
- Side-by-side refinement panel with chat input on left and live prompt preview on right with diff highlighting
- Test chat dialog for back-and-forth conversation using draft system prompt
- Context suggestion UI with checkboxes for knowledge docs and integrations
- Config tab restructured to integrate all new cards with section-based prompt display

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration, Anthropic SDK, prompt generator core module, and agent service extension** - `eae8af3` (feat)
2. **Task 2: Role Definition card, SKILL.md card, refinement panel, test chat, context suggestions, and Config tab integration** - `9f83c20` (feat)

## Files Created/Modified
- `packages/db/schema/033_agent_role_hierarchy.sql` - Migration adding role_definition, skill_definition, role, parent_agent_id columns
- `packages/core/prompt-generator/generator-types.ts` - Type definitions: RoleDefinition, PromptSections, GenerationResult, RefinementRequest, TestChatMessage
- `packages/core/prompt-generator/prompt-templates.ts` - Meta-prompts for generation and refinement
- `packages/core/prompt-generator/generator-service.ts` - Claude-powered prompt + SKILL.md generation
- `packages/core/prompt-generator/refinement-service.ts` - Iterative prompt refinement with change tracking
- `packages/core/prompt-generator/test-chat-service.ts` - Test chat with draft system prompt
- `apps/web/_actions/prompt-generator-actions.ts` - Server Actions for generate, refine, test chat, and save
- `apps/web/_components/role-definition-card.tsx` - Structured role definition form with Generate button
- `apps/web/_components/skill-definition-card.tsx` - SKILL.md display with inline edit
- `apps/web/_components/prompt-refinement-panel.tsx` - Side-by-side refinement with chat and live preview
- `apps/web/_components/prompt-diff-viewer.tsx` - Line-by-line diff with red/green highlighting
- `apps/web/_components/test-chat-dialog.tsx` - Dialog for testing draft prompts
- `apps/web/_components/context-suggestion-ui.tsx` - Checkboxes for knowledge docs and integrations
- `apps/web/_components/agent-config.tsx` - Major restructure with new cards and section-based display
- `apps/web/_components/agent-detail-tabs.tsx` - Extended Agent interface and prop threading
- `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` - Fetches knowledge docs and integrations

## Decisions Made
- Meta-prompts instruct Claude to output structured JSON with separate fields for each prompt section and SKILL.md
- Used claude-sonnet-4-20250514 model for all generation, refinement, and test chat operations
- DialogTrigger uses inline styled span instead of asChild prop (base-ui does not support asChild)
- Department type extracted from agents join with unknown-first cast to handle Supabase array/object join ambiguity
- Anthropic SDK pattern mirrors existing OpenAI embedder pattern: getApiKey() helper + getClient() factory

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DialogTrigger asChild prop**
- **Found during:** Task 2 (test-chat-dialog.tsx)
- **Issue:** base-ui Dialog does not support asChild prop (Radix-specific)
- **Fix:** Replaced DialogTrigger asChild with inline styled span matching button appearance
- **Files modified:** apps/web/_components/test-chat-dialog.tsx
- **Verification:** pnpm turbo typecheck passes
- **Committed in:** 9f83c20 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed departments join type ambiguity**
- **Found during:** Task 2 (prompt-generator-actions.ts)
- **Issue:** Supabase join returns departments as array or object depending on context, causing type error
- **Fix:** Used unknown-first cast with array/object detection for department type extraction
- **Files modified:** apps/web/_actions/prompt-generator-actions.ts
- **Verification:** pnpm turbo typecheck passes
- **Committed in:** 9f83c20 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for type safety. No scope creep.

## Issues Encountered
None beyond the auto-fixed type errors above.

## User Setup Required
ANTHROPIC_API_KEY environment variable must be set in .env.local for prompt generation, refinement, and test chat to function. Without it, the services throw descriptive errors.

## Next Phase Readiness
- Prompt generation infrastructure complete, ready for 08-02 (Agent Role Hierarchy)
- Schema migration 033 already includes role and parent_agent_id columns needed by 08-02
- All prompt generator services exported and accessible from Server Actions

---
*Phase: 08-role-definition-and-prompt-generation*
*Completed: 2026-03-28*
