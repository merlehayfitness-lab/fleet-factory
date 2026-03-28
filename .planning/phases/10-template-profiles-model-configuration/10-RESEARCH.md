# Phase 10: Template Profiles & Model Configuration - Research

**Researched:** 2026-03-28
**Domain:** JSONB profile editing UI, model selection dropdown, MCP tool configuration, template-agent inheritance
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Model dropdown appears on BOTH the template form AND the agent config tab (agent can override template default)
- Claude models only: Opus, Sonnet, Haiku (current + latest versions)
- Friendly names only in the dropdown (e.g., "Claude Sonnet 4") -- no raw model IDs visible to admin
- Model selection only for now -- no temperature/max tokens/parameter editing (parameters stay in raw JSON if needed later)
- tool_profile stores BOTH MCP server configs AND a tool allowlist section
- Per-department default tool profiles: Sales gets CRM tools, Support gets helpdesk tools, etc.
- MCP server connections should be tested/validated on save (ping the URL to verify reachable)
- Structured form by default with a toggle to switch to raw JSON editor for power users
- Editing opens in a side panel (drawer) -- click edit, slide-out panel appears, doesn't navigate away
- Save persists to DB, then prompts "Redeploy to apply changes?" since agents run on VPS
- Add tool flow: "Add Tool" or "Add MCP Server" button shows a list of known tools/MCPs, admin selects one and then configures it
- Copy on create + "Sync from template" button -- agent gets a snapshot of template profiles at creation, can pull latest with sync button
- Per-department default models: Owner=Opus, Sales=Sonnet, Support=Haiku, Operations=Sonnet
- No divergence badge when agent overrides template model -- just show current value
- "Sync from template" shows a diff of what will change and requires confirmation dialog before overwriting

### Claude's Discretion
- Exact list of known tools/MCPs to populate the add-tool picker
- Tool profile JSON schema shape (as long as it supports MCP configs + allowlist)
- Structured form field layout in the drawer
- How to handle the raw JSON <-> structured form toggle (data conversion)

### Deferred Ideas (OUT OF SCOPE)
- AITMPL integration for tool/MCP catalog -- Phase 15
- Temperature/max tokens/advanced model parameters UI -- future enhancement
- Multi-provider model support (OpenAI, Gemini) -- out of scope, Claude only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TMPL-01 | Agent templates store optional tool_profile (JSONB) defining available tools and MCP configurations | Schema already has tool_profile JSONB column on both agent_templates and agents tables. Need to define the structured shape and populate per-department defaults. |
| TMPL-02 | Agent templates store optional model_profile (JSONB) defining model selection and parameters | Schema already has model_profile JSONB column. Need model dropdown that writes to `model_profile.model` key (3 existing read sites depend on this). |
| TMPL-03 | Model Profile on agent config page is changeable via dropdown with available models | Build model selector component with CLAUDE_MODELS constant. Dropdown on both template form and agent config tab. |
| TMPL-04 | Tool/Model Profile JSON editable via structured form or raw JSON editor | Side-panel drawer with structured form + raw JSON toggle. Existing task-detail-panel.tsx provides the fixed-position drawer pattern. |
</phase_requirements>

## Summary

Phase 10 transforms the currently empty `tool_profile` and `model_profile` JSONB blobs into functional, editable configuration with meaningful defaults and proper UI.

The database schema already supports this phase -- both `agent_templates` and `agents` tables have `tool_profile jsonb DEFAULT '{}'` and `model_profile jsonb DEFAULT '{}'` columns. No schema migration is needed. The work is entirely about: (1) defining the JSON shape for tool_profile, (2) building a model selector dropdown, (3) creating the structured editing UI in a side panel, (4) populating per-department defaults in the seed data, and (5) implementing the "Sync from template" flow.

The codebase currently reads `model_profile.model` in three critical locations: the OpenClaw config generator (`openclaw-config.ts`), the deployment service (two places in `service.ts`), and the test chat service (`test-chat-service.ts`). The model dropdown MUST write to this exact key path to maintain compatibility.

**Primary recommendation:** Define a `CLAUDE_MODELS` constant mapping friendly names to API model IDs, build a reusable `ModelSelector` component, and create a `ProfileEditorDrawer` component using the existing fixed-position panel pattern from `task-detail-panel.tsx`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14+ | Server Components, Server Actions | Already in stack |
| shadcn/ui (base-ui) | current | Select, Dialog, Card, Tabs components | Already installed and used throughout |
| react-hook-form | current | Form state management | Already used in template-form.tsx |
| Zod | v4 | Schema validation | Already used for template schemas |
| Supabase JS | current | Database operations | Already in stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | current | Toast notifications | Already installed; use for save/redeploy prompts |
| lucide-react | current | Icons | Already installed; use for edit/toggle icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom fixed-position drawer | shadcn Sheet component | Sheet not currently installed; custom panel already has established pattern from Phase 4 |
| Monaco Editor for JSON | Textarea with JSON parse | Monaco adds 1.5MB bundle; Textarea is sufficient for MVP JSON editing |
| JSON Schema form generator | Hand-built structured form | Generators add complexity; hand-built gives full control over UX |

**Installation:**
No new packages needed. All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/core/
├── agent/
│   ├── model-constants.ts      # CLAUDE_MODELS map, model types
│   └── tool-profile-schema.ts  # tool_profile JSON schema/types
apps/web/
├── _components/
│   ├── model-selector.tsx       # Reusable model dropdown
│   ├── profile-editor-drawer.tsx # Side panel for tool/model editing
│   ├── tool-profile-form.tsx    # Structured form for tool_profile
│   └── mcp-server-form.tsx      # MCP server config sub-form
├── _actions/
│   └── agent-actions.ts         # Extended with sync-from-template action
```

### Pattern 1: Claude Model Constants Map
**What:** Single source of truth for model names, IDs, and per-department defaults
**When to use:** Every model dropdown, runtime config, metering

```typescript
// packages/core/agent/model-constants.ts

export interface ClaudeModel {
  id: string;           // API model ID: "claude-opus-4-6"
  friendlyName: string; // Display name: "Claude Opus 4.6"
  tier: "opus" | "sonnet" | "haiku";
  generation: string;   // "4.6", "4.5", etc.
  pricing: { input: number; output: number }; // per MTok
  isLatest: boolean;
}

export const CLAUDE_MODELS: ClaudeModel[] = [
  {
    id: "claude-opus-4-6",
    friendlyName: "Claude Opus 4.6",
    tier: "opus",
    generation: "4.6",
    pricing: { input: 5, output: 25 },
    isLatest: true,
  },
  {
    id: "claude-sonnet-4-6",
    friendlyName: "Claude Sonnet 4.6",
    tier: "sonnet",
    generation: "4.6",
    pricing: { input: 3, output: 15 },
    isLatest: true,
  },
  {
    id: "claude-haiku-4-5-20251001",
    friendlyName: "Claude Haiku 4.5",
    tier: "haiku",
    generation: "4.5",
    pricing: { input: 1, output: 5 },
    isLatest: true,
  },
  // Legacy models (still available)
  {
    id: "claude-sonnet-4-5-20250929",
    friendlyName: "Claude Sonnet 4.5",
    tier: "sonnet",
    generation: "4.5",
    pricing: { input: 3, output: 15 },
    isLatest: false,
  },
  {
    id: "claude-opus-4-5-20251101",
    friendlyName: "Claude Opus 4.5",
    tier: "opus",
    generation: "4.5",
    pricing: { input: 5, output: 25 },
    isLatest: false,
  },
  {
    id: "claude-sonnet-4-20250514",
    friendlyName: "Claude Sonnet 4",
    tier: "sonnet",
    generation: "4.0",
    pricing: { input: 3, output: 15 },
    isLatest: false,
  },
];

/** Per-department default model tier mapping. */
export const DEPARTMENT_DEFAULT_MODELS: Record<string, string> = {
  owner: "claude-opus-4-6",
  sales: "claude-sonnet-4-6",
  support: "claude-haiku-4-5-20251001",
  operations: "claude-sonnet-4-6",
};

/** Get a model by ID. Returns undefined if not found. */
export function getModelById(modelId: string): ClaudeModel | undefined {
  return CLAUDE_MODELS.find((m) => m.id === modelId);
}

/** Get friendly name for a model ID. Falls back to the raw ID. */
export function getModelFriendlyName(modelId: string): string {
  return getModelById(modelId)?.friendlyName ?? modelId;
}
```

### Pattern 2: Tool Profile JSON Schema Shape
**What:** Structured shape for tool_profile JSONB that supports both MCP servers and tool allowlists
**When to use:** Tool profile editing, validation, sandbox checks

```typescript
// packages/core/agent/tool-profile-schema.ts

export interface McpServerConfig {
  name: string;        // Human-friendly name
  url: string;         // Server URL (stdio:// or http://)
  transport: "stdio" | "http" | "sse";
  env?: Record<string, string>; // Environment variables
  enabled: boolean;
}

export interface ToolProfileShape {
  allowed_tools: string[];           // Tool allowlist (["*"] for all)
  mcp_servers: McpServerConfig[];    // MCP server configurations
  departments?: Record<string, string[] | "*">; // Per-department overrides
}

// Default empty profile
export const EMPTY_TOOL_PROFILE: ToolProfileShape = {
  allowed_tools: ["*"],
  mcp_servers: [],
};
```

### Pattern 3: Fixed-Position Drawer Panel
**What:** Side panel pattern already used in Phase 4 for task details
**When to use:** Profile editing drawer
**Source:** `apps/web/_components/task-detail-panel.tsx`

```tsx
// Existing pattern from codebase
<div className="fixed inset-0 z-50 flex justify-end">
  {/* Backdrop */}
  <div
    className="absolute inset-0 bg-black/10 backdrop-blur-xs"
    onClick={onClose}
  />
  {/* Panel */}
  <div className="relative z-10 flex w-full max-w-md flex-col bg-popover shadow-lg ring-1 ring-foreground/10">
    {/* Header + Content */}
  </div>
</div>
```

For the profile editor, use `max-w-lg` or `max-w-xl` to accommodate form fields and raw JSON editor.

### Pattern 4: Structured Form <-> Raw JSON Toggle
**What:** Toggle between structured form and raw JSON textarea with bidirectional data sync
**When to use:** Tool profile and model profile editing

```typescript
// State management pattern
const [viewMode, setViewMode] = useState<"form" | "json">("form");
const [jsonText, setJsonText] = useState(JSON.stringify(profile, null, 2));
const [jsonError, setJsonError] = useState<string | null>(null);

function handleToggle(mode: "form" | "json") {
  if (mode === "json") {
    // Form -> JSON: serialize current form state
    setJsonText(JSON.stringify(buildProfileFromForm(), null, 2));
    setJsonError(null);
  } else {
    // JSON -> Form: parse JSON text into form state
    try {
      const parsed = JSON.parse(jsonText);
      applyProfileToForm(parsed);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON - fix before switching to form view");
      return; // Don't switch if JSON is invalid
    }
  }
  setViewMode(mode);
}
```

### Pattern 5: Sync from Template with Diff Preview
**What:** Fetch template's current profiles, diff against agent's, show confirmation dialog
**When to use:** "Sync from template" button on agent config page

```typescript
// Server Action pattern
export async function getTemplateDiffAction(
  agentId: string,
  businessId: string,
): Promise<{
  template: { tool_profile: Record<string, unknown>; model_profile: Record<string, unknown> };
  agent: { tool_profile: Record<string, unknown>; model_profile: Record<string, unknown> };
  hasChanges: boolean;
} | { error: string }> {
  // Fetch both agent and its template
  // Return both for client-side diff rendering
}

export async function syncFromTemplateAction(
  agentId: string,
  businessId: string,
): Promise<{ success: true } | { error: string }> {
  // Overwrite agent tool_profile and model_profile from template
  // Audit log the sync event
}
```

### Anti-Patterns to Avoid
- **Storing friendly names in DB:** Store only the API model ID (`claude-opus-4-6`) in `model_profile.model`. Map to friendly names at display time. This prevents data inconsistency if names change.
- **Deep-merging profiles on sync:** The user decided "copy on create + sync button". Sync should be a full overwrite of tool_profile and model_profile, not a deep merge. Show the diff first and let the admin confirm.
- **Validating MCP URLs on every render:** MCP server validation (ping) should happen on save only, not on form load. Show a "Test Connection" button next to each MCP server entry.
- **Putting model constants in the web app:** Model constants belong in `packages/core` so they're available to both the web UI and the runtime/deployment system. The metering module already references model names.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model name <-> ID mapping | Inline string comparisons | `CLAUDE_MODELS` constant map in core | Single source of truth, used by UI dropdown + runtime + metering |
| Side panel / drawer | New Sheet component | Existing fixed-position pattern from task-detail-panel.tsx | Already established in codebase, no new dependencies |
| JSON editing | Custom syntax highlighting | Standard Textarea with try/catch JSON.parse | MVP sufficient; Monaco editor deferred |
| Form validation | Manual checks | Zod schema extending existing template-schema.ts | Consistent with codebase pattern |

**Key insight:** The existing codebase has every infrastructure piece needed. The tool_profile and model_profile columns exist, the update actions exist, the drawer pattern exists. This phase is primarily about defining shapes, building UI components, and populating meaningful defaults.

## Common Pitfalls

### Pitfall 1: Breaking model_profile.model Key Path
**What goes wrong:** New model dropdown writes to a different key (e.g., `model_profile.modelId` instead of `model_profile.model`), breaking runtime config generation, test chat, and deployment.
**Why it happens:** Not checking all existing read sites before designing the data shape.
**How to avoid:** The codebase reads `model_profile.model` in exactly these locations:
  - `packages/runtime/generators/openclaw-config.ts` line 60: `(agent.modelProfile as { model?: string }).model`
  - `packages/core/deployment/service.ts` lines 389 and 659: `((a.model_profile...).model as string)`
  - `packages/core/prompt-generator/test-chat-service.ts` line 48: `modelProfile?.model`
  - `apps/web/_components/agent-card.tsx` line 61: `(agent.model_profile as Record<string, string>).model`

  The model dropdown MUST write to `{ model: "claude-opus-4-6" }` -- this exact key path.
**Warning signs:** Test chat stops working, deployment generates "default" model instead of selected model.

### Pitfall 2: Seed Data Overwrite on Re-run
**What goes wrong:** Updating seed templates with per-department default tool_profile/model_profile wipes existing customizations if the seed script uses `ON CONFLICT DO UPDATE`.
**Why it happens:** Current seed uses `ON CONFLICT DO NOTHING`, which is safe. But if changed to upsert, it would overwrite.
**How to avoid:** Keep `ON CONFLICT DO NOTHING` in seed SQL. Apply defaults through a separate migration that uses `UPDATE ... WHERE tool_profile = '{}'::jsonb` to only touch empty profiles.
**Warning signs:** After re-seeding, template customizations disappear.

### Pitfall 3: JSON Parse Errors on Toggle
**What goes wrong:** User edits raw JSON, introduces syntax error, switches back to form view -- app crashes or silently loses data.
**Why it happens:** No validation gate on the form/JSON toggle transition.
**How to avoid:** Validate JSON before allowing switch from JSON to form. Show inline error. Keep both representations in state so nothing is lost.
**Warning signs:** "Unexpected token" console errors, blank form after toggling.

### Pitfall 4: MCP Server Validation Blocking Save
**What goes wrong:** MCP server ping fails (server temporarily unreachable) and blocks the entire profile save.
**Why it happens:** Treating MCP validation as a hard gate instead of advisory.
**How to avoid:** Make MCP validation a soft warning: "Server unreachable -- save anyway?" Still allow save with a warning badge. Admin may be configuring for future deployment.
**Warning signs:** Admins can't save tool profiles because staging MCP servers are down.

### Pitfall 5: Provision RPC Not Using Defaults
**What goes wrong:** New businesses still get empty `{}` tool_profile and model_profile because the provision RPC copies from templates, and templates haven't been updated.
**Why it happens:** The provision_business_tenant RPC copies `v_template.tool_profile` and `v_template.model_profile` verbatim. If templates are still `{}`, new agents get `{}`.
**How to avoid:** Update the seed templates with meaningful defaults BEFORE running provisioning. The RPC itself is correct -- it copies template values faithfully.
**Warning signs:** New businesses still show "No tools configured" and "Default model".

## Code Examples

### Model Selector Component
```tsx
// apps/web/_components/model-selector.tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLAUDE_MODELS, getModelById } from "@agency-factory/core";

interface ModelSelectorProps {
  value: string;          // Current model ID
  onValueChange: (modelId: string) => void;
  showLegacy?: boolean;   // Show non-latest models
}

export function ModelSelector({
  value,
  onValueChange,
  showLegacy = false,
}: ModelSelectorProps) {
  const models = showLegacy
    ? CLAUDE_MODELS
    : CLAUDE_MODELS.filter((m) => m.isLatest);

  const currentModel = getModelById(value);

  return (
    <Select
      value={value}
      onValueChange={(val: string | null) => {
        if (val) onValueChange(val);
      }}
    >
      <SelectTrigger>
        <SelectValue>
          {currentModel?.friendlyName ?? "Select model"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.friendlyName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Per-Department Default Tool Profiles
```typescript
// Recommended shape for seed data defaults
const DEPARTMENT_DEFAULT_TOOL_PROFILES: Record<string, ToolProfileShape> = {
  owner: {
    allowed_tools: ["review_dashboard", "generate_report", "update_business_settings"],
    mcp_servers: [],
  },
  sales: {
    allowed_tools: ["search_contacts", "draft_email", "send_email", "create_deal", "update_deal_stage"],
    mcp_servers: [],
  },
  support: {
    allowed_tools: ["search_tickets", "create_ticket", "respond_to_ticket", "close_ticket", "search_kb"],
    mcp_servers: [],
  },
  operations: {
    allowed_tools: ["check_system_status", "run_diagnostic", "update_config", "schedule_maintenance"],
    mcp_servers: [],
  },
};
```

### Sync from Template Diff Dialog
```tsx
// Pattern: controlled AlertDialog showing diff before overwrite
<AlertDialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Sync from Template</AlertDialogTitle>
      <AlertDialogDescription>
        This will overwrite the agent's profiles with the template's current values.
      </AlertDialogDescription>
    </AlertDialogHeader>
    {/* Side-by-side diff cards */}
    <div className="max-h-64 overflow-y-auto space-y-4">
      {modelChanged && <DiffSection label="Model" ... />}
      {toolsChanged && <DiffSection label="Tool Profile" ... />}
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleSync}>
        Overwrite Agent Profiles
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### MCP Server Known Catalog
```typescript
// Known MCP servers for the add-tool catalog picker
export const KNOWN_MCP_SERVERS = [
  {
    name: "Filesystem",
    description: "Read and write files within sandboxed directories",
    transport: "stdio" as const,
    defaultUrl: "npx -y @modelcontextprotocol/server-filesystem",
    category: "system",
    configFields: [
      { key: "allowed_directories", label: "Allowed Directories", type: "text" },
    ],
  },
  {
    name: "GitHub",
    description: "Access GitHub repositories, issues, and pull requests",
    transport: "stdio" as const,
    defaultUrl: "npx -y @modelcontextprotocol/server-github",
    category: "development",
    configFields: [
      { key: "GITHUB_PERSONAL_ACCESS_TOKEN", label: "GitHub Token", type: "secret" },
    ],
  },
  {
    name: "Slack",
    description: "Send and receive Slack messages",
    transport: "stdio" as const,
    defaultUrl: "npx -y @modelcontextprotocol/server-slack",
    category: "communication",
    configFields: [
      { key: "SLACK_BOT_TOKEN", label: "Slack Bot Token", type: "secret" },
      { key: "SLACK_TEAM_ID", label: "Team ID", type: "text" },
    ],
  },
  {
    name: "PostgreSQL",
    description: "Query PostgreSQL databases",
    transport: "stdio" as const,
    defaultUrl: "npx -y @modelcontextprotocol/server-postgres",
    category: "data",
    configFields: [
      { key: "POSTGRES_CONNECTION_STRING", label: "Connection String", type: "secret" },
    ],
  },
  {
    name: "Brave Search",
    description: "Web search via Brave Search API",
    transport: "stdio" as const,
    defaultUrl: "npx -y @modelcontextprotocol/server-brave-search",
    category: "search",
    configFields: [
      { key: "BRAVE_API_KEY", label: "Brave API Key", type: "secret" },
    ],
  },
  {
    name: "Custom HTTP",
    description: "Connect to any HTTP-based MCP server",
    transport: "http" as const,
    defaultUrl: "",
    category: "custom",
    configFields: [
      { key: "url", label: "Server URL", type: "text" },
      { key: "api_key", label: "API Key (optional)", type: "secret" },
    ],
  },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Empty `{}` JSONB blobs | Structured profiles with typed shapes | Phase 10 | Enables actual tool/model management |
| `claude-sonnet-4-20250514` hardcoded | Model dropdown from `CLAUDE_MODELS` constant | Phase 10 | Per-agent model selection |
| Raw JSON textarea only | Structured form + JSON toggle | Phase 10 | Admin-friendly editing |
| No template sync | Copy-on-create + sync button with diff | Phase 10 | Template-agent profile management |

**Current model IDs (verified from Anthropic docs, March 2026):**
- Latest: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- Legacy (still available): `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`, `claude-opus-4-1-20250805`, `claude-sonnet-4-20250514`
- Deprecated (retiring April 2026): `claude-3-haiku-20240307`

**Existing codebase references to update:**
- `packages/core/worker/metering.ts` uses shorthand keys `"claude-sonnet"`, `"claude-haiku"`, `"claude-opus"` -- these should be updated or aliased to match the real API model IDs
- `packages/core/prompt-generator/generator-service.ts` hardcodes `"claude-sonnet-4-20250514"` -- should use model from constant
- `packages/core/prompt-generator/test-chat-service.ts` hardcodes same -- should use model from profile or constant

## Open Questions

1. **MCP Server Validation Mechanism**
   - What we know: User wants MCP server URLs validated on save (ping to verify reachable)
   - What's unclear: For `stdio` transport MCP servers (launched via `npx`), a URL ping doesn't make sense -- they're local processes
   - Recommendation: Only validate `http`/`sse` transport servers with a fetch HEAD request. For `stdio` servers, validate the command exists but skip connectivity check. Show result as advisory (warning), not blocking.

2. **Metering Module Model Key Alignment**
   - What we know: `packages/core/worker/metering.ts` uses shorthand keys (`"claude-sonnet"`) that don't match real API model IDs (`"claude-sonnet-4-6"`)
   - What's unclear: Whether updating metering keys would break existing usage_records data
   - Recommendation: Add alias mapping in the metering module that maps full API IDs to pricing tiers, keeping backward compatibility with existing shorthand keys. Handle this in Phase 10 since we're touching model_profile.

3. **Redeploy Prompt UX**
   - What we know: User wants "Redeploy to apply changes?" prompt after profile save
   - What's unclear: Whether this should be a toast with action button, a dialog, or inline banner
   - Recommendation: Use toast with action button pattern (`toast("Profiles saved", { action: { label: "Redeploy", onClick: ... } })`) -- lightweight, non-blocking, consistent with existing toast patterns.

## Sources

### Primary (HIGH confidence)
- Anthropic Models Overview (https://platform.claude.com/docs/en/about-claude/models/overview) -- verified model IDs, pricing, latest/legacy status
- Codebase analysis: `packages/db/schema/005_agent_templates.sql`, `006_agents.sql` -- confirmed JSONB columns exist
- Codebase analysis: `packages/core/deployment/service.ts` -- confirmed `model_profile.model` key path
- Codebase analysis: `packages/runtime/generators/openclaw-config.ts` -- confirmed model read pattern
- Codebase analysis: `packages/core/prompt-generator/test-chat-service.ts` -- confirmed model usage in test chat
- Codebase analysis: `apps/web/_components/task-detail-panel.tsx` -- confirmed fixed-position drawer pattern
- Codebase analysis: `packages/core/worker/tool-catalog.ts` -- confirmed per-department tool lists

### Secondary (MEDIUM confidence)
- MCP server catalog: based on official @modelcontextprotocol npm packages (well-known servers)
- Model pricing: verified from Anthropic docs page

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, no new dependencies
- Architecture: HIGH -- patterns directly drawn from existing codebase (drawer, form, action patterns)
- Pitfalls: HIGH -- identified from actual code analysis of 4+ read sites for model_profile.model
- Model IDs: HIGH -- verified from official Anthropic documentation (March 2026)
- Tool profile schema: MEDIUM -- shape is at Claude's discretion per CONTEXT.md; designed to match existing sandbox.ts expectations

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- existing schema, established patterns, model IDs verified)
