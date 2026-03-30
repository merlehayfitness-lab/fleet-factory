# Phase 12: Integrations Catalog & Setup -- Research

**Researched:** 2026-03-29
**Phase Goal:** Replace per-agent "Add Mock" buttons with a centralized browsable integration catalog dialog, support department-level and multi-target assignment, auto-populate category fields, and generate AI-powered setup instructions via streaming Claude API.

## 1. Existing Code That Must Change

### Integrations Page (`apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx`)

Currently a Server Component that fetches all integrations with agent names, all business agents, and renders the `IntegrationsOverview` component. Phase 12 adds an "Add Integration" button at the top of this page that opens the catalog dialog. The page must also fetch departments (for department-level assignment targets). The page header area needs the new button, and the rest of the page content remains as the integration overview.

### Integrations Overview (`apps/web/_components/integrations-overview.tsx`)

Currently groups integrations by type (CRM, Email, Helpdesk, Calendar, Messaging) with summary stats and shows which agents lack integrations. Phase 12 does not fundamentally change this component -- it remains the read-only overview. However, the empty state message ("Visit an agent's detail page to add integrations") must change to reference the new "Add Integration" button instead. The component may also need to handle department-level integrations (where `agent_id` is NULL but a `department_id` or `scope` field indicates department-level assignment).

### Agent Integrations Tab (`apps/web/_components/agent-integrations.tsx`)

Currently shows 5 integration type sections per agent, each with an "Add Mock" button for unconfigured types and a provider dropdown for configured ones. Phase 12 replaces the per-type "Add Mock" buttons with a single "Add from Catalog" button that opens the same catalog dialog, pre-scoped to this agent. The existing configured integration cards can remain as-is. The `PROVIDER_OPTIONS` mapping (mock + real providers per type) is useful reference for the catalog entries.

### Integration Config Card (`apps/web/_components/integration-config-card.tsx`)

Read-only card showing agent name, status badge, provider, and capabilities. Phase 12 adds a "Setup Instructions" button (or regenerate icon) to each card that opens/re-opens the AI setup instructions. Otherwise the card structure stays the same. May need to handle department-level integrations (show department name instead of agent name when `agent_id` is NULL).

### Integration Actions (`apps/web/_actions/integration-actions.ts`)

Currently has `getAgentIntegrationsAction`, `getBusinessIntegrationsAction`, `saveIntegrationAction`, and `deleteIntegrationAction`. Phase 12 needs:
- A new `addCatalogIntegrationAction` that accepts integration type, provider, and multiple targets (agent IDs and/or department IDs) and creates integration records for each target.
- A new `generateSetupInstructionsAction` that calls Claude to generate contextual setup instructions.
- Modification to `saveIntegrationAction` to handle department-level integrations (NULL `agent_id`, new `department_id` or `scope` field).

### Integration Schema (`packages/db/schema/014_integrations_table.sql`)

Current schema: `integrations(id, business_id, agent_id, provider, type, config, status, created_at, updated_at)` with UNIQUE constraint on `(business_id, agent_id, type)`. Phase 12 introduces department-level assignment, which means:
- `agent_id` must become nullable (it currently allows NULL via FK reference but the UNIQUE constraint assumes agent_id is always present)
- A new `department_id` column is needed (nullable, FK to departments)
- The UNIQUE constraint must change: `(business_id, agent_id, type)` breaks for department-level entries (agent_id would be NULL). Options:
  - Replace with two partial unique indexes: one for agent-level `(business_id, agent_id, type) WHERE agent_id IS NOT NULL` and one for department-level `(business_id, department_id, type) WHERE department_id IS NOT NULL`
  - Or add `department_id` to the constraint and use COALESCE
- A `setup_instructions` text column to store generated AI instructions for re-display

### Integration Service (`packages/core/integrations/service.ts`)

Currently handles agent-level CRUD only. Phase 12 needs:
- `upsertIntegration` to accept optional `departmentId` parameter (for department-level assignment)
- A new `getIntegrationsForDepartment` function
- Bulk creation support: inserting multiple integrations in one call (for multi-assign)
- Update `getIntegrationsForBusiness` to join with departments table too

### Integration Adapter Registry (`packages/core/integrations/index.ts`)

Currently maps 5 types to mock adapters. Phase 12 catalog needs richer metadata per integration: name, description, icon/logo reference, category. This metadata lives in the catalog data, not the adapter. The adapter interface and registry can remain unchanged -- the catalog is a UI-level data structure that maps to adapter types.

### Core Types (`packages/core/types/index.ts`)

`IntegrationType` is currently `"crm" | "email" | "helpdesk" | "calendar" | "messaging"`. Phase 12 does not add new types -- the 5 categories remain. The catalog entries map to these existing types.

## 2. New Database Schema

### Migration: Add department_id and setup_instructions to integrations

```sql
-- 038_integrations_department_scope.sql

-- Add department_id for department-level integrations
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments ON DELETE CASCADE;

-- Add setup_instructions for AI-generated instructions
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS setup_instructions text;

-- Add name column for display (e.g., "Slack", "HubSpot" instead of just provider key)
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS name text;

-- Index for department-level lookups
CREATE INDEX IF NOT EXISTS idx_integrations_department
  ON public.integrations (department_id);

-- Drop old unique constraint and replace with partial indexes
-- Old: UNIQUE(business_id, agent_id, type) -- breaks for NULL agent_id
DROP INDEX IF EXISTS idx_integrations_business_agent_type;

-- Agent-level uniqueness (one integration per type per agent per business)
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_agent_unique
  ON public.integrations (business_id, agent_id, type)
  WHERE agent_id IS NOT NULL;

-- Department-level uniqueness (one integration per type per department per business)
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_department_unique
  ON public.integrations (business_id, department_id, type)
  WHERE department_id IS NOT NULL;
```

This allows:
- Agent-level: `agent_id` set, `department_id` NULL -- existing behavior
- Department-level: `department_id` set, `agent_id` NULL -- new behavior, inherits to all agents in department

### No New Tables Required

The catalog itself is a static data structure in code (not a database table). Integration entries are stored in the existing `integrations` table with the new columns. No separate `integration_catalog` table is needed since the catalog is a hardcoded list of 10-15 known integrations with metadata.

## 3. New Dependencies Required

### No New Dependencies

- **Anthropic SDK**: Already installed (`@anthropic-ai/sdk`), used in `packages/core/prompt-generator/`
- **Streaming**: The Anthropic SDK supports `client.messages.stream()` natively. However, the project currently uses non-streaming `client.messages.create()` for all Claude calls (generator, refinement, test-chat). For Phase 12, streaming to the client requires either:
  - **Option A: Server Action with polling** -- Generate instructions server-side (non-streaming), store in DB, client polls or refetches. Simple, matches existing patterns.
  - **Option B: Next.js `ai` SDK streaming** -- Uses `@vercel/ai` for server-side streaming to client. Adds a dependency.
  - **Option C: Direct Anthropic streaming** -- Use `client.messages.stream()` in a Route Handler, client reads via `fetch` + ReadableStream. No new dependency, but requires a new API route (not Server Action).
  - **Recommendation: Option A** -- Non-streaming generation stored in DB, matching the existing pattern. The CONTEXT says "streaming Claude API call" but the project has zero streaming infrastructure. A loading/spinner state while generating (2-4 seconds) is adequate UX. If streaming is truly desired, Option C is the simplest path.

- **Brand logos/icons**: The CONTEXT requests real brand logos. Options:
  - Bundled SVG icons -- import from a library like `simple-icons` (npm package with 2000+ brand SVGs)
  - CDN URLs to logo services
  - Local SVG files in the project
  - **Recommendation**: Bundle 10-15 SVG logos as local files in `apps/web/public/integrations/` or inline as React components. No dependency needed for this small count.

## 4. Architecture Decisions

### Catalog Data Model

The catalog is a static TypeScript constant, not a database table. Each entry contains metadata needed for browsing and creating integrations:

```typescript
interface CatalogEntry {
  id: string;              // Unique key: "slack", "hubspot", "stripe", etc.
  name: string;            // Display name: "Slack", "HubSpot", "Stripe"
  description: string;     // Short description: "Team messaging and collaboration"
  category: IntegrationType; // Maps to existing 5 types
  provider: string;        // Provider key for adapter: "slack", "hubspot", etc.
  logoUrl: string;         // Path to SVG: "/integrations/slack.svg"
  isReal: boolean;         // Whether this has a real connection flow (vs mock)
  defaultConfig?: Record<string, unknown>; // Default config shape
}

const INTEGRATION_CATALOG: CatalogEntry[] = [
  // CRM (3)
  { id: "hubspot", name: "HubSpot", category: "crm", ... },
  { id: "salesforce", name: "Salesforce", category: "crm", ... },
  { id: "pipedrive", name: "Pipedrive", category: "crm", ... },
  // Email (3)
  { id: "sendgrid", name: "SendGrid", category: "email", ... },
  { id: "mailgun", name: "Mailgun", category: "email", ... },
  { id: "ses", name: "Amazon SES", category: "email", ... },
  // Helpdesk (3)
  { id: "zendesk", name: "Zendesk", category: "helpdesk", ... },
  { id: "freshdesk", name: "Freshdesk", category: "helpdesk", ... },
  { id: "intercom", name: "Intercom", category: "helpdesk", ... },
  // Calendar (2)
  { id: "google-calendar", name: "Google Calendar", category: "calendar", ... },
  { id: "outlook-calendar", name: "Outlook Calendar", category: "calendar", ... },
  // Messaging (3)
  { id: "slack", name: "Slack", category: "messaging", ... },
  { id: "teams", name: "Microsoft Teams", category: "messaging", ... },
  { id: "discord", name: "Discord", category: "messaging", ... },
];
```

### Catalog Dialog Flow

Per CONTEXT: "Opens as a dialog/modal overlay on the current integrations page."

```
Step 1: Browse & Select Integration
  - Search bar at top
  - Category groups: CRM, Email, Helpdesk, Calendar, Messaging
  - Each entry: logo, name, description
  - Click to select -> proceed to Step 2

Step 2: Assign Targets
  - Single picker showing departments AND agents together
  - Multi-select: checkboxes for departments and individual agents
  - Department selection means "all agents in this department"
  - After selecting targets -> immediately create integrations -> transition to Step 3

Step 3: AI Setup Instructions
  - Integration created, modal transitions to show instructions
  - Loading/streaming state while Claude generates
  - Instructions rendered as markdown
  - "Regenerate" button
  - "Done" button to close
```

The dialog is a multi-step controlled Dialog with state management for current step, selected integration, selected targets, and generated instructions.

### Assignment Model: Department Inheritance

Per CONTEXT: "Department assignment inherits down to all agents in that department."

Two approaches:

**Option A: Create individual integration records per agent (expand on write)**
- When assigning to a department, create one integration record per agent in that department
- Pro: Simple querying (all integrations are agent-level)
- Con: New agents added later don't inherit; many records

**Option B: Store department-level record, inherit on read (lazy inheritance)**
- Create one record with `department_id` set, `agent_id` NULL
- When querying agent integrations, also check department-level records
- Pro: Clean data model, new agents auto-inherit, fewer records
- Con: More complex query logic

**Recommendation: Option B (lazy inheritance)** -- Cleaner semantics, matches the CONTEXT description of "inherits down," and new agents auto-get department integrations. The query for "what integrations does this agent have?" becomes:
```sql
SELECT * FROM integrations
WHERE (agent_id = $agentId)
   OR (department_id = $deptId AND agent_id IS NULL)
```

### AI Setup Instructions Generation

Per CONTEXT: "Generated in real-time via streaming Claude API call... Instructions combine generic provider setup AND contextual guidance tailored to the assigned department/agent role."

The generation service takes:
- Integration name, type, provider
- Target context: department type, agent roles, business industry
- Existing agent system prompt (for role context)

Prompt structure:
```
System: You are an integration setup expert. Generate clear, actionable setup instructions.
User: Generate setup instructions for {integration name} ({category}) being configured for:
- Business: {name} ({industry})
- Target: {department/agent name} ({role/type})
Include:
1. What API keys/credentials are needed
2. Where to find them in the provider's dashboard
3. Required permissions/scopes
4. Webhook configuration (if applicable)
5. How this integration specifically helps this department/agent's workflow
```

Output: Markdown text stored in `setup_instructions` column on the integration record.

### Which 1-2 Integrations to Wire with Real Connections

Per CONTEXT Claude's Discretion: "Which 1-2 integrations to wire with real connections."

**Recommendation: Slack + HubSpot**
- **Slack**: Phase 14 is dedicated to Slack integration, so wiring a basic Slack OAuth + webhook connection now provides groundwork. Slack's OAuth 2.0 is well-documented and the Bot Token flow is straightforward. Demo value is very high (visible real-time messaging).
- **HubSpot**: Free developer account, simple API key auth (no OAuth needed for basic read access), and CRM data (contacts, deals) provides immediate demo value for the Sales department.

However, given Phase 14 is entirely about Slack, it may be better to keep Slack as mock here and wire:
- **HubSpot** (CRM -- API key auth, free tier, immediate data)
- **SendGrid** (Email -- API key auth, free tier, immediate send capability)

These are the simplest to wire (API key only, no OAuth) and cover two different categories.

### Logo/Icon Strategy

Per CONTEXT: "Real brand logos."

Approach: Create SVG files in `apps/web/public/integrations/` for each catalog entry. Source from Simple Icons (open-source brand SVG collection under CC0). For the 14 integrations in the catalog, manually curate 14 SVGs.

File structure:
```
apps/web/public/integrations/
  hubspot.svg
  salesforce.svg
  pipedrive.svg
  sendgrid.svg
  mailgun.svg
  ses.svg
  zendesk.svg
  freshdesk.svg
  intercom.svg
  google-calendar.svg
  outlook-calendar.svg
  slack.svg
  teams.svg
  discord.svg
```

Referenced as `<Image src="/integrations/slack.svg" ... />` in the catalog UI.

### Category Auto-Population

Per CONTEXT and INTG-ENH-04: "Category field auto-populates based on integration selection."

When the admin selects an integration from the catalog (e.g., HubSpot), the `type` field is automatically set to the integration's category (`crm`). No manual category selection is needed. This is trivially handled by the `CatalogEntry.category` field mapping directly to the `integrations.type` column on insert.

## 5. File Impact Analysis

### New Files (estimated ~8-10)

**`packages/core/integrations/catalog.ts`** -- Static catalog data: `INTEGRATION_CATALOG` array with all 14 entries, categories, metadata. Exported from core for use in both server and client.

**`packages/core/integrations/instructions-service.ts`** -- AI instruction generation service. Uses Anthropic SDK to generate setup instructions. Server-only (imports from core/server).

**`apps/web/_components/integration-catalog-dialog.tsx`** -- Multi-step dialog: browse catalog -> select targets -> view AI instructions. Main catalog browsing UI with search and category groups.

**`apps/web/_components/catalog-target-picker.tsx`** -- Multi-select picker showing departments and agents as assignment targets. Checkboxes with department/agent grouping.

**`apps/web/_components/catalog-instructions-panel.tsx`** -- AI setup instructions display panel. Shows loading state, rendered markdown instructions, regenerate button.

**`apps/web/public/integrations/*.svg`** -- 14 SVG logo files for brand icons.

### Modified Files (estimated ~8-10)

**`packages/db/schema/038_integrations_department_scope.sql`** -- New migration: add `department_id`, `setup_instructions`, `name` columns, replace unique constraint with partial indexes.

**`packages/db/schema/_combined_schema.sql`** -- Updated with migration 038.

**`packages/core/integrations/service.ts`** -- Add `getIntegrationsForDepartment`, `bulkCreateIntegrations`, update `upsertIntegration` for department scope, update `getIntegrationsForBusiness` to join departments.

**`packages/core/integrations/index.ts`** -- Export catalog data.

**`packages/core/index.ts`** -- Export `INTEGRATION_CATALOG` and new types.

**`packages/core/server.ts`** -- Export `generateSetupInstructions` from instructions-service.

**`apps/web/_actions/integration-actions.ts`** -- Add `addCatalogIntegrationAction`, `generateSetupInstructionsAction`, `getIntegrationsWithDepartmentsAction`.

**`apps/web/app/(dashboard)/businesses/[id]/integrations/page.tsx`** -- Add "Add Integration" button, fetch departments, pass to dialog.

**`apps/web/_components/integrations-overview.tsx`** -- Update empty state message, handle department-level integrations in display.

**`apps/web/_components/integration-config-card.tsx`** -- Add "View Setup" button, handle department name display.

**`apps/web/_components/agent-integrations.tsx`** -- Replace per-type "Add Mock" buttons with "Add from Catalog" button opening the dialog pre-scoped to this agent.

### Unchanged Files

- `packages/core/integrations/adapter.ts` -- Interface unchanged
- `packages/core/integrations/mock-*.ts` -- All 5 mock adapters unchanged
- `apps/web/_components/agent-detail-tabs.tsx` -- Tab structure unchanged
- `apps/web/_components/sidebar-nav.tsx` -- Navigation unchanged
- Deployment pipeline -- No changes
- Agent service -- No changes

## 6. Plan Breakdown Strategy

### Plan 12-01: Catalog Data, Schema Migration, and Catalog Dialog UI
**Scope:** Foundation -- catalog data model, DB migration, and the browsable catalog dialog (Steps 1-2 of dialog flow)
- Create `INTEGRATION_CATALOG` static data in `packages/core/integrations/catalog.ts` with all 14 entries
- Add SVG logo files to `apps/web/public/integrations/`
- Create migration 038: add `department_id`, `setup_instructions`, `name` columns, partial unique indexes
- Update `packages/core/integrations/service.ts`: add `bulkCreateIntegrations`, `getIntegrationsForDepartment`, update queries for department scope
- Create `integration-catalog-dialog.tsx`: multi-step dialog with browse/search UI, category groups, logo display
- Create `catalog-target-picker.tsx`: multi-select for departments + agents
- Add `addCatalogIntegrationAction` server action for bulk creation with department/agent targets
- Update integrations page: add "Add Integration" button, fetch departments
- Update `integrations-overview.tsx`: handle department-level integrations display, update empty state
- Update `agent-integrations.tsx`: replace "Add Mock" with "Add from Catalog" button
- Update core exports

**Requirements covered:** INTG-ENH-01 (browsable catalog), INTG-ENH-02 (department/agent assignment), INTG-ENH-04 (category auto-populates)

**Files ~14-16** (including 14 SVG files)

### Plan 12-02: AI Setup Instructions and Regeneration
**Scope:** AI instruction generation and display
- Create `instructions-service.ts` in `packages/core/integrations/` -- Claude-powered instruction generation with contextual prompts
- Create `catalog-instructions-panel.tsx` -- instruction display with loading state, markdown rendering, regenerate button
- Add `generateSetupInstructionsAction` server action
- Wire Step 3 of catalog dialog: after integration creation, transition to instruction display
- Add "View Setup" / "Regenerate Instructions" button to `integration-config-card.tsx`
- Store generated instructions in `setup_instructions` column
- Update core/server exports

**Requirements covered:** INTG-ENH-03 (AI-generated setup instructions)

**Files ~5-7**

## 7. Requirement Coverage

| Requirement | Covered By | Implementation |
|-------------|-----------|----------------|
| INTG-ENH-01 | Plan 12-01 | "Add Integration" button on integrations page opens a Dialog with browsable catalog. 14 integrations across 5 categories with search bar, category grouping, real brand logos, names, and descriptions. Same dialog accessible from agent detail Integrations tab. |
| INTG-ENH-02 | Plan 12-01 | After selecting an integration, target picker shows departments AND agents with multi-select. Department-level assignment uses new `department_id` column with lazy inheritance to all agents in that department. Integration records created immediately on target selection. |
| INTG-ENH-03 | Plan 12-02 | After adding integration, dialog transitions to show AI-generated setup instructions. Claude generates contextual instructions combining provider setup docs with department/agent role context. Instructions stored in `setup_instructions` column. Regeneratable via button on integration cards. |
| INTG-ENH-04 | Plan 12-01 | Each catalog entry has a `category` field mapping to `IntegrationType`. When selected, the integration's `type` field is automatically set from the catalog entry's category. No manual category selection needed. |

All 4 requirements covered across 2 plans.

## 8. Technical Considerations

### Unique Constraint Change and Existing Data

The current UNIQUE constraint is on `(business_id, agent_id, type)`. Existing data all has `agent_id` set. Replacing with partial indexes is safe:
1. Drop old index: `DROP INDEX IF EXISTS idx_integrations_business_agent_type`
2. Create agent-level partial index: `WHERE agent_id IS NOT NULL` -- covers all existing rows
3. Create department-level partial index: `WHERE department_id IS NOT NULL` -- for new rows

No data migration needed. Existing rows continue to work with the agent-level partial index.

### Department Inheritance Query Pattern

When showing "all integrations for agent X", the query must include both direct agent-level and inherited department-level integrations:

```sql
-- Agent's direct integrations + department-level inherited integrations
SELECT i.*, d.name as department_name, a.name as agent_name
FROM integrations i
LEFT JOIN departments d ON i.department_id = d.id
LEFT JOIN agents a ON i.agent_id = a.id
WHERE i.business_id = $businessId
  AND (
    i.agent_id = $agentId
    OR (i.department_id = $departmentId AND i.agent_id IS NULL)
  )
ORDER BY i.type;
```

In the overview, department-level integrations show "Department: Sales" instead of an agent name.

### `onConflict` for Upsert with Partial Indexes

Supabase/PostgREST `upsert` with `onConflict` only works with named constraints or column lists. With partial unique indexes, the standard `onConflict: "business_id,agent_id,type"` approach may need adjustment. Two options:
- Use INSERT ... ON CONFLICT with explicit WHERE clause via raw SQL (RPC)
- Implement check-then-insert pattern: query first, then INSERT or UPDATE

For simplicity, the bulk create action can check for existing records and skip duplicates, rather than relying on upsert with partial indexes.

### AI Instruction Generation -- Model and Cost

Using the same Sonnet model as prompt generation (`CLAUDE_MODELS.find(m => m.tier === "sonnet" && m.isLatest)`). Each instruction generation is a single API call with ~500 token input and ~800-1200 token output. Cost: ~$0.005 per generation. Regeneration triggers a fresh API call.

### Streaming vs Non-Streaming Instructions

The CONTEXT says "Generated in real-time via streaming Claude API call." The project has no existing streaming infrastructure for Claude responses. Options:

1. **Non-streaming with loading state** (simplest, matches patterns): Call `client.messages.create()`, show a spinner for 2-4 seconds, display full result. Store in DB.
2. **Streaming via Route Handler** (new pattern): Create `app/api/integrations/instructions/route.ts`, use `client.messages.stream()`, return a ReadableStream. Client reads chunks and displays progressively.

Recommendation: Start with non-streaming (Plan 12-02). If UX feels slow, streaming can be added as a polish step. The loading state is brief enough that streaming provides marginal UX improvement.

### Multi-Target Bulk Creation

When assigning one integration to multiple targets (e.g., "Slack" to Sales department + Support department + individual Agent X), the server action creates multiple `integrations` rows in one call. A single Supabase `.insert()` with an array of records handles this efficiently. Each target gets its own integration record with:
- Department targets: `department_id` set, `agent_id` NULL
- Agent targets: `agent_id` set, `department_id` NULL (or set to agent's department for reference)

### Logo SVG Sizing and Consistency

Brand SVGs come in varying aspect ratios and sizes. For consistency in the catalog grid:
- Fixed 40x40px container with `object-contain`
- SVGs should be square or near-square crops where possible
- Fallback: First letter of integration name in a colored circle (like avatar fallback pattern)

### Existing PROVIDER_OPTIONS Compatibility

The `agent-integrations.tsx` component defines `PROVIDER_OPTIONS` per type (e.g., CRM: mock, salesforce, hubspot). The catalog replaces this as the source of truth for available integrations. The provider dropdown on existing integration cards should still work for changing providers on already-configured integrations, but new integrations come through the catalog flow.

## 9. Risk Assessment

### Low Risk
- **Static catalog data** -- Hardcoded TypeScript constant with 14 entries. No external data fetching, no API dependencies.
- **Category auto-population** -- Trivial field mapping from catalog entry to integration type.
- **SVG logos** -- Static files served from `/public/`. Fallback to text initials if any logo fails.
- **Dialog UI** -- Reuses existing Dialog component from shadcn/ui. Multi-step pattern well-established in the codebase (business creation wizard, skill template browser, GitHub import dialog).
- **Anthropic API call** -- Same SDK pattern used in 3 existing services (generator, refinement, test-chat). No new patterns needed.

### Medium Risk
- **Schema migration (partial unique indexes)** -- Replacing the existing unique constraint with two partial indexes requires careful ordering (drop old, create new). If applied to a production DB with existing data, the intermediate state (no unique constraint) could allow duplicates. Mitigate: Run in a transaction or apply during maintenance window.
- **Department-level inheritance** -- Changes how integrations are queried everywhere. All existing code assumes `agent_id` is always set. Must audit all integration queries to handle NULL `agent_id` + department-level records. Mitigate: Thorough query updates in service layer and actions.
- **Upsert with partial indexes** -- Standard Supabase upsert may not work cleanly with partial unique indexes. Mitigate: Use check-then-insert pattern for bulk creation instead of upsert.

### No High Risks

This phase is primarily a UI enhancement with a small schema addition. The core data model (5 integration types, mock adapters, per-business scoping) remains unchanged. The AI instruction generation is a self-contained feature with graceful fallback (just show "Instructions unavailable" if API key missing or call fails).

## RESEARCH COMPLETE
