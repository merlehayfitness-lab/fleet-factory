# Phase 2: Agent Management - Research

**Researched:** 2026-03-25
**Domain:** Agent templates CRUD, agent lifecycle management, freeze/pause/retire controls, card-grid UI, tabbed detail page, template diff
**Confidence:** HIGH

## Summary

Phase 2 adds three capabilities on top of Phase 1's foundation: (1) a full CRUD agent templates system so admins can manage the blueprints agents are created from, (2) an agents list page with department-grouped card layout showing status, template, and quick lifecycle actions, and (3) an agent detail page with a 4-tab layout (Overview, Config, Activity, Conversations) including emergency freeze controls and template diff visualization.

The most critical technical decisions are: add a `frozen` status to the agents table CHECK constraint (the current schema only has `provisioning|active|paused|error|retired`), add RLS INSERT/UPDATE/DELETE policies on `agent_templates` for admin-level CRUD (currently only SELECT exists), and build lifecycle state transitions as Server Actions in `packages/core` with explicit valid-transition maps to prevent illegal state changes.

**Primary recommendation:** Build the schema migration and core agent service first (template CRUD + lifecycle transitions), then the templates page, then the agents list page, then the agent detail page with tabs. The backend service layer is the foundation that both UI pages consume.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGNT-01 | Agent templates store system_prompt, tool_profile, model_profile per department_type | Schema already has these columns. Need CRUD RLS policies + Server Actions for template management. |
| AGNT-02 | Admin can view list of agents per business with status, department, and template info | Card grid grouped by department. Query agents with department and template joins. |
| AGNT-03 | Admin can view agent detail page with config, status, recent activity, conversations | 4-tab layout. Overview (hero + lifecycle controls), Config (prompt + template diff), Activity (audit log), Conversations (placeholder). |
| AGNT-04 | Agents track lifecycle status (provisioning, active, paused, error, retired) | Current schema has these 5 statuses. Need to ADD `frozen` per user decision. State machine in packages/core. |
| AGNT-05 | Admin can freeze an agent immediately (emergency control) | `frozen` status added to agents CHECK constraint. Server Action + confirmation dialog. Audit log entry. |
| AGNT-06 | Agents created only from approved templates (no dynamic spawning) | Already enforced: agents.template_id is NOT NULL FK to agent_templates. Provisioning RPC creates agents from templates only. |
| DASH-06 | Agents list page per business | Card grid grouped by department with status badges, template name, model profile, and kebab menu actions. |
| DASH-07 | Agent detail page (config, status, activity, conversations) | Tabbed layout with 4 tabs. Overview hero + lifecycle buttons. Config shows system prompt and template diff. |
</phase_requirements>

## Schema Changes Required

### 1. Add `frozen` status to agents table

The current CHECK constraint on `agents.status` allows: `provisioning`, `active`, `paused`, `error`, `retired`. The user decided on 6 lifecycle statuses including `frozen`. This requires an ALTER TABLE migration.

```sql
-- Migration: Add frozen status to agents
ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_status_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_status_check
  CHECK (status IN ('provisioning', 'active', 'paused', 'frozen', 'error', 'retired'));
```

**Impact on domain types:** Update `AgentStatus` in `packages/core/types/index.ts` to include `'frozen'`.

**Impact on StatusBadge:** Add `frozen` entry to STATUS_CONFIG in `apps/web/_components/status-badge.tsx` with greyed-out/ice styling per user decision.

### 2. Add RLS policies for agent_templates CRUD

Currently only `agent_templates_select_authenticated` exists (global read). The user decision says "Templates page supports full CRUD -- admin can create, edit, and delete templates from the UI." Need INSERT/UPDATE/DELETE policies.

**Decision point:** Templates are global (not scoped to a business). The ISOL-04 requirement says "admin-only writable." The current approach noted in Phase 1 research was "Admin operations use service_role client (server-side only)." However, for UI-driven CRUD, we have two options:

- **Option A: service_role client in Server Actions** -- bypass RLS for template writes. Simpler but requires careful access control in the Server Action layer.
- **Option B: RLS policies gated by a global admin check** -- e.g., a `is_global_admin()` function that checks if the user has the owner role on ANY business. More secure at the database level.

**Recommendation:** Option B. Create an `is_platform_admin()` function. For MVP, any authenticated user with at least one `owner` role on any business qualifies. This keeps RLS enforcement consistent and avoids service_role leaks.

```sql
-- RLS helper for platform-level admin operations
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users bu
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.role = 'owner'
  );
$$;

-- Template write policies
CREATE POLICY "agent_templates_insert_admin" ON public.agent_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());

CREATE POLICY "agent_templates_update_admin" ON public.agent_templates
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "agent_templates_delete_admin" ON public.agent_templates
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());
```

### 3. No new tables required

All data storage needs are met by existing tables:
- `agent_templates` -- template CRUD (already exists)
- `agents` -- agent lifecycle (already exists, needs frozen status)
- `departments` -- department grouping for agent list (already exists)
- `audit_logs` -- activity log on agent detail page (already exists)
- `conversations` -- conversations tab placeholder (table not yet created, but conversations tab can show empty state for now since COMM-* requirements are Phase 5)

**Note on conversations table:** The `conversations` table is listed in PROJECT.md core entities but was NOT created in the Phase 1 schema. The Conversations tab will render an empty placeholder state. Creating the conversations table is a Phase 5 concern (COMM-01, COMM-02, COMM-03).

## Standard Stack

### Core (Phase 2 specific -- no new external dependencies)

Phase 2 requires NO new npm packages beyond what Phase 1 installed. All UI components come from shadcn/ui CLI. All data access uses the existing Supabase client.

| Component | Source | Purpose |
|-----------|--------|---------|
| shadcn/ui Tabs | `pnpm dlx shadcn@latest add tabs` | Agent detail 4-tab layout |
| shadcn/ui Dialog | `pnpm dlx shadcn@latest add dialog` | Confirmation dialogs for freeze/retire |
| shadcn/ui AlertDialog | `pnpm dlx shadcn@latest add alert-dialog` | Destructive action confirmations |

**Already installed from Phase 1:**
- Card, Badge, Button, Input, Label, Select, Table, Separator, Avatar, DropdownMenu, Textarea

### Supporting

| Library | Already Installed | Purpose in Phase 2 |
|---------|-------------------|---------------------|
| react-hook-form | Yes (Phase 1) | Template create/edit forms |
| zod | Yes (Phase 1) | Template validation schemas, agent action validation |
| lucide-react | Yes (Phase 1) | Agent status icons, department icons, action icons |
| sonner | Yes (Phase 1) | Toast notifications for lifecycle actions |

## Architecture Patterns

### Pattern 1: Agent Lifecycle State Machine

**What:** Explicit valid-transition map that prevents illegal state changes.
**When to use:** Every agent status update.
**Why:** Prevents bugs like "freeze a retired agent" or "resume a provisioning agent." Makes the lifecycle rules visible and testable.

```typescript
// packages/core/agent/lifecycle.ts

import type { AgentStatus } from "../types";

/** Valid state transitions for agent lifecycle */
const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  provisioning: ["active", "error"],
  active: ["paused", "frozen", "error", "retired"],
  paused: ["active", "frozen", "retired"],
  frozen: ["active", "retired"],
  error: ["active", "retired"],
  retired: [], // terminal state -- no transitions out
};

export function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: AgentStatus, to: AgentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid agent transition: ${from} -> ${to}. ` +
      `Valid transitions from ${from}: ${VALID_TRANSITIONS[from].join(", ") || "none"}`
    );
  }
}
```

### Pattern 2: Agent Service Layer in packages/core

**What:** Thin service functions for agent operations that Server Actions delegate to.
**When to use:** All agent mutations (freeze, pause, resume, retire, update config).
**Why:** Follows the established "thin Server Action" pattern from Phase 1. Business logic lives in `packages/core`, not in Server Actions.

```typescript
// packages/core/agent/service.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentStatus } from "../types";
import { assertTransition } from "./lifecycle";

export async function transitionAgentStatus(
  supabase: SupabaseClient,
  agentId: string,
  businessId: string,
  newStatus: AgentStatus,
): Promise<void> {
  // 1. Fetch current status
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("id, status")
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !agent) throw new Error("Agent not found");

  // 2. Validate transition
  assertTransition(agent.status as AgentStatus, newStatus);

  // 3. Update status
  const { error: updateError } = await supabase
    .from("agents")
    .update({ status: newStatus })
    .eq("id", agentId)
    .eq("business_id", businessId);

  if (updateError) throw new Error(`Status update failed: ${updateError.message}`);

  // 4. Audit log
  await supabase.from("audit_logs").insert({
    business_id: businessId,
    action: `agent.${newStatus}`,
    entity_type: "agent",
    entity_id: agentId,
    metadata: { previous_status: agent.status, new_status: newStatus },
  });
}
```

### Pattern 3: Department-Grouped Card Grid

**What:** Agents grouped by department with section headers, rendered as a card grid.
**When to use:** Agents list page only.
**Why:** User decision: "Card grid layout, not data table. Grouped by department with section headers."

```typescript
// Grouping logic (pure function in packages/core or inline in component)
function groupAgentsByDepartment(
  agents: AgentWithDepartment[]
): Map<string, AgentWithDepartment[]> {
  const groups = new Map<string, AgentWithDepartment[]>();
  for (const agent of agents) {
    const key = agent.department_name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(agent);
  }
  return groups;
}
```

### Pattern 4: Server Action for Agent Lifecycle

**What:** Thin Server Actions for each lifecycle operation, following the Phase 1 pattern.
**When to use:** Freeze, pause, resume, retire actions from the UI.

```typescript
// apps/web/_actions/agent-actions.ts
"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { transitionAgentStatus } from "@fleet-factory/core";
import { revalidatePath } from "next/cache";

export async function freezeAgent(agentId: string, businessId: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  await transitionAgentStatus(supabase, agentId, businessId, "frozen");
  revalidatePath(`/businesses/${businessId}/agents`);
  revalidatePath(`/businesses/${businessId}/agents/${agentId}`);
}
```

### Pattern 5: Template CRUD with Validation

**What:** Zod schemas for template create/edit, service functions in packages/core, thin Server Actions.
**When to use:** Template management page.

```typescript
// packages/core/agent/template-schema.ts
import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().min(2).max(100),
  department_type: z.enum(["owner", "sales", "support", "operations"]),
  description: z.string().max(500).optional(),
  system_prompt: z.string().min(10),
  tool_profile: z.record(z.unknown()).optional(),
  model_profile: z.record(z.unknown()).optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();
```

### Anti-Patterns to Avoid

- **Lifecycle transitions without validation:** Never directly `.update({ status: 'frozen' })` without checking current status against the valid transitions map. A retired agent must never be frozen.
- **Mixing template CRUD with business-scoped RLS:** Templates are global, not per-business. Using `is_business_member()` for template writes is wrong. Use `is_platform_admin()`.
- **Building the conversations tab with real data:** Conversations table does not exist yet (Phase 5). Render a placeholder. Do not create the table early.
- **State in Server Components for tabs:** Tabs require client interaction. The agent detail page should use a client component for the tab container, with data passed as props from the Server Component parent.
- **Inline lifecycle logic in components:** All lifecycle validation and state transitions belong in `packages/core/agent/`, not in component files or Server Action files.

## Recommended File Structure (Phase 2 scope)

```
apps/web/
  _actions/
    agent-actions.ts          # freeze, pause, resume, retire, update agent config
    template-actions.ts       # CRUD operations on agent templates
  _components/
    agents-list.tsx           # Card grid grouped by department
    agent-card.tsx            # Single agent card with status, template, actions
    agent-detail-tabs.tsx     # Client component: 4-tab layout container
    agent-overview.tsx        # Overview tab: hero status + lifecycle controls
    agent-config.tsx          # Config tab: system prompt, template diff
    agent-activity.tsx        # Activity tab: audit log entries
    agent-conversations.tsx   # Conversations tab: placeholder
    template-list.tsx         # Templates page list/grid
    template-form.tsx         # Create/edit template form
    freeze-dialog.tsx         # Confirmation dialog for freeze action
    retire-dialog.tsx         # Type-to-confirm dialog for retire action
  app/(dashboard)/businesses/[id]/
    agents/
      page.tsx                # Agents list page (Server Component)
      [agentId]/
        page.tsx              # Agent detail page (Server Component)
    templates/
      page.tsx                # Templates list page
      new/
        page.tsx              # Create template page
      [templateId]/
        edit/
          page.tsx            # Edit template page

packages/core/
  agent/
    lifecycle.ts              # State machine, canTransition, assertTransition
    service.ts                # transitionAgentStatus, updateAgentConfig
    template-service.ts       # createTemplate, updateTemplate, deleteTemplate
    template-schema.ts        # Zod schemas for template validation
  index.ts                    # Updated exports
  types/index.ts              # Updated AgentStatus with 'frozen'
```

## Route Structure

| Route | Type | Description |
|-------|------|-------------|
| `/businesses/[id]/agents` | Server Component | Agents list grouped by department |
| `/businesses/[id]/agents/[agentId]` | Server Component + Client Tabs | Agent detail with 4 tabs |
| `/businesses/[id]/templates` | Server Component | Templates list page |
| `/businesses/[id]/templates/new` | Client Component | Create template form |
| `/businesses/[id]/templates/[templateId]/edit` | Client Component | Edit template form |

**Note on templates route:** Templates are global (not per-business), but routing them under `/businesses/[id]/templates` keeps navigation consistent within the business context. The data queries will NOT filter by business_id -- they fetch all templates.

**Alternative:** Route templates at `/templates` (top-level). This is more semantically accurate since templates are global, but breaks the navigation pattern. Given the user decided "Templates also visible on each agent's config tab (linked to template + diff)", keeping templates under the business route makes link navigation simpler.

**Recommendation:** Use `/businesses/[id]/templates` for UI navigation consistency. The sidebar nav already scopes everything under a business context.

## Sidebar Navigation Updates

The sidebar nav needs two additions:
1. **Agents link** -- enabled, under the existing business sub-nav
2. **Templates link** -- new addition, under the business sub-nav

Currently in `sidebar-nav.tsx`, the business sub-nav has Overview and Departments enabled, with Deployments/Approvals/Tasks/Logs disabled. Phase 2 adds Agents (enabled) and Templates (enabled).

The Bot icon from lucide-react is already imported in `business-overview.tsx` for the agents stat card. Use the same icon for the agents nav link. Use a `FileText` or `LayoutTemplate` icon for templates.

## UI Component Details

### Agent Card (inside agents-list)

Per user decision: "Each card shows: agent name, status badge, template name, and model profile. Quick actions available on each card via kebab menu or icon buttons (freeze, pause, etc.)"

```
+-----------------------------------+
| [Icon] Agent Name     [...] kebab |
| StatusBadge   TemplateName        |
| Model: claude-sonnet              |
+-----------------------------------+
```

The kebab menu (DropdownMenu, already installed) offers: Pause, Resume, Freeze, Retire -- filtered by valid transitions from the agent's current status.

### Frozen Agent Styling

Per user decision: "Frozen agents should feel visually 'dead' -- greyed out card with an ice-themed badge, clearly distinct from paused or error states."

StatusBadge addition:
```typescript
frozen: {
  variant: "secondary",
  className: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
},
```

Card wrapper for frozen agents:
```typescript
<Card className={cn(agent.status === "frozen" && "opacity-50 grayscale")}>
```

### Agent Detail Tabs

Per user decision: 4 tabs -- Overview, Config, Activity, Conversations.

- **Overview:** Big status badge + lifecycle control buttons. Freeze button is red with confirmation dialog. Retire requires type-to-confirm.
- **Config:** System prompt in a code/text block (not collapsed). Shows which template the agent was created from (link to template). Highlights config that differs from the template.
- **Activity:** Recent audit log entries filtered by `entity_type = 'agent'` and `entity_id = agentId`.
- **Conversations:** Empty placeholder state. "Conversations will appear here once the command center is live (Phase 5)."

### Template Diff

Per user decision: "Config tab shows which template the agent was created from with a link, plus highlights any config that differs from the template (diff view)."

Implementation approach: Fetch the agent's `template_id`, load the template, and compare `system_prompt`, `tool_profile`, `model_profile` field by field. For MVP, a simple side-by-side or inline diff showing "Template value" vs "Agent value" for any fields that differ is sufficient. No need for a full code-diff library.

```typescript
function hasConfigDrift(agent: Agent, template: AgentTemplate): boolean {
  return (
    agent.system_prompt !== template.system_prompt ||
    JSON.stringify(agent.tool_profile) !== JSON.stringify(template.tool_profile) ||
    JSON.stringify(agent.model_profile) !== JSON.stringify(template.model_profile)
  );
}
```

### Type-to-Confirm for Retire

Per user decision: "Retire requires type-to-confirm (type agent name) -- prevents accidental permanent action."

This is a custom AlertDialog variant where the confirm button is disabled until the user types the exact agent name. No external library needed -- implement with controlled input + string comparison.

## Common Pitfalls

### Pitfall 1: Missing `frozen` in Agent Status CHECK Constraint
**What goes wrong:** Attempting to set `status = 'frozen'` fails at the database level with a CHECK constraint violation. The current schema only allows 5 statuses.
**How to avoid:** Apply the ALTER TABLE migration BEFORE building any freeze functionality. Update the combined schema SQL and the domain types in packages/core.
**Warning signs:** "new row violates check constraint agents_status_check" errors.

### Pitfall 2: No RLS Policies for Template Writes
**What goes wrong:** Server Actions using the anon-key Supabase client to INSERT/UPDATE/DELETE templates silently return zero affected rows because no write policies exist.
**How to avoid:** Add INSERT/UPDATE/DELETE policies gated by `is_platform_admin()` before building template CRUD UI.
**Warning signs:** Template create/edit/delete operations return success but data doesn't persist.

### Pitfall 3: Tab State Lost on Navigation
**What goes wrong:** Agent detail tabs implemented as separate routes (`/agents/[id]/config`, `/agents/[id]/activity`) cause full page reloads and lose tab context.
**How to avoid:** Use client-side tabs (shadcn/ui Tabs component) with all tab content rendered in one page. Pass data as props from the parent Server Component.
**Warning signs:** Flash of loading state when switching tabs, URL changes on tab click.

### Pitfall 4: Lifecycle Transitions Without Audit Trail
**What goes wrong:** Agent status changes happen but nobody knows who did what or when. Debugging and accountability are impossible.
**How to avoid:** Every status transition MUST insert an audit_log entry with the previous status, new status, and actor. Build this into the service layer, not the UI.
**Warning signs:** Empty activity tab despite many status changes.

### Pitfall 5: Agent Config Editable Without Template Diff
**What goes wrong:** Admin edits an agent's system prompt but can't tell if it matches the template or has drifted. Template updates can't be reconciled.
**How to avoid:** Always show the template reference and diff state on the config tab. Highlight drifted fields.
**Warning signs:** Admin confusion about whether an agent is "standard" or "customized."

### Pitfall 6: revalidatePath Missing After Mutations
**What goes wrong:** After freezing/pausing/retiring an agent, the UI shows stale data because the Server Component cache is not invalidated.
**How to avoid:** Every Server Action that mutates agent or template data must call `revalidatePath()` for all affected routes (list page + detail page).
**Warning signs:** UI shows old status after performing an action, requires manual page refresh.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab components | Custom tab state management | shadcn/ui Tabs | Accessible keyboard nav, ARIA roles, focus management |
| Confirmation dialogs | Custom modal with useState | shadcn/ui AlertDialog | Focus trapping, escape key, accessible announcement |
| Dropdown menus | Custom popover | shadcn/ui DropdownMenu (already installed) | Keyboard nav, outside click, submenu support |
| Status badge variants | Separate badge per status type | Existing StatusBadge component | Already built in Phase 1, add `frozen` variant |
| Form validation | Manual regex checks | Zod + react-hook-form (already installed) | Type-safe, composable, validated at runtime and compile time |

## State of the Art

No significant changes since Phase 1 research (2026-03-25). The same tech stack applies:
- Next.js 15 App Router with Server Components
- shadcn/ui v4 with base-ui primitives (NOT Radix `asChild`)
- Tailwind CSS v4 with OKLCH colors
- React 19 with direct ref props

**Reminder from Phase 1 gotchas:**
- base-ui Button does NOT support `asChild`. Use `buttonVariants()` for Link elements.
- Zod `.default()` causes type mismatch with react-hook-form. Use form `defaultValues` instead.
- `redirect()` throws `NEXT_REDIRECT` -- never wrap in try/catch.

## Open Questions

### 1. Template route location
- **What we know:** Templates are global (not per-business). User wants a "dedicated templates page."
- **What's unclear:** Should the route be `/templates` (top-level) or `/businesses/[id]/templates` (within business context)?
- **Recommendation:** `/businesses/[id]/templates` for navigation consistency. The data is global but the UI context is business-scoped.

### 2. Agent config editability scope
- **What we know:** User decided "Agent config is editable per-agent -- template is the starting point, not a hard constraint."
- **What's unclear:** Should system_prompt editing happen inline on the config tab, or via a separate edit page?
- **Recommendation:** Inline editing on the config tab with a save button. Keeps the workflow fast (admin sees config, edits, saves). Matches the "fast operator workflows over flashy design" UI principle.

### 3. Activity log pagination
- **What we know:** Activity tab shows audit log entries for the agent.
- **What's unclear:** Pagination approach (infinite scroll, page numbers, or load more button).
- **Recommendation:** Simple "load more" button showing 20 entries at a time. Simplest to implement, sufficient for MVP.

## Metadata

**Confidence breakdown:**
- Schema changes: HIGH -- checked existing schema, identified exact constraints to modify
- Architecture patterns: HIGH -- extends established Phase 1 patterns (thin Server Actions, core service layer)
- UI components: HIGH -- shadcn/ui components verified available, base-ui gotchas documented
- Route structure: MEDIUM -- template route location is a judgment call, recommendation provided

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days -- stable domain, no external API changes)
