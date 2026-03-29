---
phase: 10-template-profiles-model-configuration
verified: 2026-03-29T17:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "ModelSelector shows friendly names and hides raw API IDs in browser"
    expected: "Selecting a model shows 'Claude Opus 4.6' not 'claude-opus-4-6' in the dropdown"
    why_human: "Can't verify display rendering programmatically"
  - test: "ProfileEditorDrawer opens as fixed side panel and JSON toggle validates correctly"
    expected: "Drawer slides in from right; switching from invalid JSON to Form shows inline error message"
    why_human: "UI interaction and error display state requires browser"
  - test: "Template form department change auto-switches model and tool profile defaults"
    expected: "Changing department_type from 'sales' to 'support' auto-updates model to Haiku and tool profile to support defaults"
    why_human: "React state behavior on field change requires interactive testing"
  - test: "Agent config model change saves and shows redeploy toast"
    expected: "Changing model in dropdown immediately calls updateAgentConfigAction and toast appears with Redeploy action button"
    why_human: "Live Supabase save and toast interaction requires browser"
---

# Phase 10: Template Profiles & Model Configuration Verification Report

**Phase Goal:** Agent templates have editable Tool Profile and Model Profile (optional JSONB), and the Model Profile on agent config is changeable via dropdown instead of static display.
**Verified:** 2026-03-29T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | CLAUDE_MODELS constant exists with 6 models (3 latest, 3 legacy) with id, friendlyName, tier, generation, pricing, isLatest | VERIFIED | `packages/core/agent/model-constants.ts` lines 19-70: 6 model entries confirmed |
| 2  | Latest models include claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001 | VERIFIED | Lines 21, 29, 37 of model-constants.ts, all with `isLatest: true` |
| 3  | DEPARTMENT_DEFAULT_MODELS maps owner->opus, sales->sonnet, support->haiku, operations->sonnet | VERIFIED | model-constants.ts lines 76-81 exactly match requirement |
| 4  | ToolProfileShape interface defines allowed_tools (string[]) and mcp_servers (McpServerConfig[]) | VERIFIED | tool-profile-schema.ts lines 20-23 |
| 5  | McpServerConfig interface defines name, url, transport (stdio|http|sse), env (optional), enabled | VERIFIED | tool-profile-schema.ts lines 12-18 |
| 6  | EMPTY_TOOL_PROFILE and KNOWN_MCP_SERVERS (6 entries) and DEPARTMENT_DEFAULT_TOOL_PROFILES exist | VERIFIED | tool-profile-schema.ts: EMPTY_TOOL_PROFILE line 32, KNOWN_MCP_SERVERS lines 53-116 (6 entries), DEPARTMENT_DEFAULT_TOOL_PROFILES lines 126-143 |
| 7  | Migration 037 uses UPDATE...WHERE with empty profile guards (idempotent-safe) | VERIFIED | 037_template_profile_defaults.sql: all 4 UPDATE statements have `AND model_profile = '{}'::jsonb AND tool_profile = '{}'::jsonb` guards |
| 8  | Migration 037 is included in _combined_schema.sql | VERIFIED | _combined_schema.sql line 1145 has `-- 037: Template profile defaults` with full content through line 1179 |
| 9  | Metering has MODEL_PRICING map with full API IDs and shorthand aliases | VERIFIED | metering.ts lines 76-90: 6 full API IDs + 3 shorthand aliases + default key |
| 10 | test-chat-service.ts and generator-service.ts use CLAUDE_MODELS instead of hardcoded strings | VERIFIED | test-chat-service.ts line 33: dynamic lookup; generator-service.ts line 37: dynamic lookup |
| 11 | syncFromTemplate function exists with template fetch, profile overwrite, and audit logging | VERIFIED | service.ts lines 230-291: full implementation with agent fetch, template fetch, update, audit log |
| 12 | Model and tool profile types exported from packages/core/index.ts (client-safe) | VERIFIED | index.ts lines 204-222: all exports confirmed (ClaudeModel, CLAUDE_MODELS, DEPARTMENT_DEFAULT_MODELS, getModelById, getModelFriendlyName, getLatestModels, getDefaultModelForDepartment, McpServerConfig, ToolProfileShape, KnownMcpServer, EMPTY_TOOL_PROFILE, KNOWN_MCP_SERVERS, DEPARTMENT_DEFAULT_TOOL_PROFILES) |
| 13 | validateMcpServerUrl and syncFromTemplate exported from packages/core/server.ts (server-only) | VERIFIED | server.ts lines 180-183 |
| 14 | ModelSelector component renders Select dropdown with friendly names, filters to latest by default, and is used on both template form and agent config | VERIFIED | model-selector.tsx: full implementation with tier grouping and showAll toggle; imported in template-form.tsx line 41 and agent-config.tsx line 19 |
| 15 | ProfileEditorDrawer is a fixed-position side panel with form/JSON toggle and bidirectional data sync with validation | VERIFIED | profile-editor-drawer.tsx: switchToForm() validates JSON before switching (lines 56-76); switchToJson() serializes form state (lines 49-54); full drawer layout lines 103-188 |
| 16 | ToolProfileForm shows tool badges with add/remove, MCP server list with KNOWN_MCP_SERVERS catalog picker | VERIFIED | tool-profile-form.tsx: tool badges lines 160-173, MCP catalog picker lines 257-291, KNOWN_MCP_SERVERS import and usage confirmed |
| 17 | SyncFromTemplateDialog with getTemplateDiffAction and syncFromTemplateAction Server Actions exists and is wired to agent-config | VERIFIED | sync-from-template-dialog.tsx: full implementation with pre-fetch diff, side-by-side preview, model friendly names; agent-actions.ts lines 148-243; agent-config.tsx line 516 renders SyncFromTemplateDialog |
| 18 | Agent card and template list show getModelFriendlyName instead of raw JSON; openclaw-config fallback updated to "claude-sonnet-4-6" | VERIFIED | agent-card.tsx line 60: getModelFriendlyName used; template-list.tsx line 123: getModelFriendlyName used; openclaw-config.ts line 60: fallback is "claude-sonnet-4-6" |

**Score:** 18/18 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/agent/model-constants.ts` | Claude model definitions, department defaults, lookup helpers | VERIFIED | 112 lines, substantive. Exports ClaudeModel, CLAUDE_MODELS, DEPARTMENT_DEFAULT_MODELS, getModelById, getModelFriendlyName, getLatestModels, getDefaultModelForDepartment |
| `packages/core/agent/tool-profile-schema.ts` | Tool profile shape, MCP server config, known MCP catalog, department defaults | VERIFIED | 197 lines, substantive. Exports McpServerConfig, ToolProfileShape, EMPTY_TOOL_PROFILE, KNOWN_MCP_SERVERS (6 entries), DEPARTMENT_DEFAULT_TOOL_PROFILES, validateMcpServerUrl |
| `packages/db/schema/037_template_profile_defaults.sql` | Migration with UPDATE...WHERE idempotent guards for all 4 departments | VERIFIED | 40 lines, 4 UPDATE statements with empty-profile WHERE guards |
| `packages/core/agent/service.ts` | syncFromTemplate function | VERIFIED | Lines 230-291: full fetch-template-update-audit implementation |
| `apps/web/_components/model-selector.tsx` | ModelSelector dropdown component | VERIFIED | 102 lines, uses CLAUDE_MODELS, tier grouping (opus/sonnet/haiku), latest-only filter with show-all toggle |
| `apps/web/_components/profile-editor-drawer.tsx` | ProfileEditorDrawer side panel with form/JSON toggle | VERIFIED | 189 lines, bidirectional toggle with JSON parse validation, fixed-position overlay pattern |
| `apps/web/_components/tool-profile-form.tsx` | ToolProfileForm for ToolProfileShape editing | VERIFIED | 298 lines, tool badge add/remove, KNOWN_MCP_SERVERS catalog picker, McpServerForm integration, testMcpConnectionAction wired |
| `apps/web/_components/mcp-server-form.tsx` | McpServerForm per-server config with test connection | VERIFIED | 217 lines, name/url/transport/env/enabled fields, Test Connection button (http/sse only), Remove with confirmation |
| `apps/web/_components/sync-from-template-dialog.tsx` | SyncFromTemplateDialog with diff preview | VERIFIED | 223 lines, pre-fetch diff pattern, side-by-side model + tool profile diff, hasChanges detection, redeploy toast |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `model-selector.tsx` | `packages/core/agent/model-constants.ts` | imports CLAUDE_MODELS, getModelById | WIRED | model-selector.tsx line 5-7: `import { CLAUDE_MODELS, getModelById } from "@agency-factory/core"` |
| `tool-profile-form.tsx` | `packages/core/agent/tool-profile-schema.ts` | imports ToolProfileShape, KNOWN_MCP_SERVERS | WIRED | tool-profile-form.tsx lines 4-12: types and constants imported and used throughout |
| `profile-editor-drawer.tsx` | `tool-profile-form.tsx` | drawer renders ToolProfileForm in form mode | WIRED | profile-editor-drawer.tsx lines 8, 155-159: ToolProfileForm imported and rendered |
| `agent-config.tsx` | `agent-actions.ts` | model dropdown calls updateAgentConfigAction | WIRED | agent-config.tsx lines 12, 213, 275, 301: updateAgentConfigAction imported and called on model/tool changes |
| `template-form.tsx` | `model-selector.tsx` | template form embeds ModelSelector | WIRED | template-form.tsx line 41: ModelSelector imported; line 306: rendered in model profile section |
| `sync-from-template-dialog.tsx` | `agent-actions.ts` | dialog calls getTemplateDiffAction and syncFromTemplateAction | WIRED | sync-from-template-dialog.tsx lines 17-19: both actions imported and used in handleOpen (line 63) and handleSync (line 82) |
| `agent-actions.ts` | `packages/core/agent/service.ts` | syncFromTemplateAction calls syncFromTemplate | WIRED | agent-actions.ts lines 228-231: dynamic import and call to syncFromTemplate from core/server |
| `agent-card.tsx` | `packages/core/agent/model-constants.ts` | model display uses getModelFriendlyName | WIRED | agent-card.tsx lines 28, 60: getModelFriendlyName imported and used |
| `test-chat-service.ts` | `model-constants.ts` | DEFAULT_MODEL replaced with CLAUDE_MODELS lookup | WIRED | test-chat-service.ts lines 10, 33: CLAUDE_MODELS imported, dynamic find used |
| `generator-service.ts` | `model-constants.ts` | GENERATOR_MODEL uses CLAUDE_MODELS lookup | WIRED | generator-service.ts lines 14, 37, 62: CLAUDE_MODELS imported, dynamic find used |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TMPL-01 | 10-01, 10-02, 10-03 | Agent templates store optional tool_profile (JSONB) defining available tools and MCP configurations | SATISFIED | ToolProfileShape type defined; migration 037 seeds tool_profile defaults; template-form.tsx has ProfileEditorDrawer for editing; tool-profile-form.tsx provides structured editing UI |
| TMPL-02 | 10-01, 10-02, 10-03 | Agent templates store optional model_profile (JSONB) defining model selection and parameters | SATISFIED | model-constants.ts defines model shape; migration 037 seeds model_profile with `{"model": "..."}` per department; template-form.tsx uses ModelSelector writing to model_profile.model |
| TMPL-03 | 10-02, 10-03 | Model Profile on agent config page is changeable via dropdown with available models | SATISFIED | agent-config.tsx line 563 renders ModelSelector; onChange calls updateAgentConfigAction with `{ model_profile: { ...agent.model_profile, model: newModelId } }` |
| TMPL-04 | 10-02 | Tool/Model Profile JSON editable via structured form or raw JSON editor | SATISFIED | ProfileEditorDrawer provides form view (ToolProfileForm) and JSON view (Textarea) with bidirectional toggle; validation gates JSON-to-form switch |

All 4 requirements (TMPL-01, TMPL-02, TMPL-03, TMPL-04) satisfied. No orphaned requirements — all are mapped to plans and all are addressed by implemented artifacts.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `model-selector.tsx` | 73 | `placeholder="Select model"` | Info | HTML placeholder attribute — not a code stub. SelectValue fallback text only. No impact. |
| `template-form.tsx` | 294 | `Use {"{{business_name}}"} as a placeholder for the tenant name.` | Info | Form hint text for template variables — not a code stub. Pre-existing behavior. |

No blocker or warning-level anti-patterns found in Phase 10 artifacts. All implementations are substantive.

---

## Human Verification Required

### 1. Model Dropdown Display in Browser

**Test:** Open an agent config page or template form and click the model selector dropdown.
**Expected:** Options show "Claude Opus 4.6", "Claude Sonnet 4.6", "Claude Haiku 4.5" — not raw API IDs. Groups labeled "Powerful", "Balanced", "Fast".
**Why human:** Can't verify rendering output programmatically.

### 2. ProfileEditorDrawer Form/JSON Toggle Validation

**Test:** Open a tool profile editor drawer, switch to JSON, enter invalid JSON, then click "Form" toggle.
**Expected:** Inline error message appears below the textarea; form switch is blocked.
**Why human:** Error display state triggered by user interaction.

### 3. Template Form Department Auto-Switch

**Test:** Create or edit a template. Change the department_type dropdown from "sales" to "support".
**Expected:** Model selector auto-switches to Haiku 4.5 and tool profile switches to support defaults (search_tickets, create_ticket, etc.).
**Why human:** React state change behavior requires interactive testing.

### 4. Agent Config Model Save and Redeploy Toast

**Test:** Open an agent config page, change the model in the dropdown.
**Expected:** Save happens immediately (no separate button), and a toast appears with "Model updated to Claude [Name]" plus a "Redeploy" action button.
**Why human:** Live Supabase save and toast interaction requires a running app.

### 5. Sync from Template Dialog Diff Preview

**Test:** On an agent config page where agent profiles differ from template, click "Sync from Template".
**Expected:** Dialog opens showing model change (current vs template with friendly names) and/or tool profile diff. "Overwrite Agent Profiles" button triggers sync and shows redeploy toast.
**Why human:** Requires populated database state with agent/template diff.

---

## Summary

Phase 10 goal fully achieved. All 18 must-have truths are verified against the actual codebase — not just the summary claims.

**Data layer (plan 01):** Single source of truth for Claude models established (`CLAUDE_MODELS` with 6 entries, pricing, tier). Structured `ToolProfileShape` with `McpServerConfig` types defined. `KNOWN_MCP_SERVERS` catalog has 6 entries. Migration 037 seeds per-department defaults idempotently. Metering extended with model-specific pricing. Hardcoded model strings eliminated from prompt generator services. `syncFromTemplate` added to agent service.

**UI layer (plan 02):** All 4 new components (`ModelSelector`, `ProfileEditorDrawer`, `ToolProfileForm`, `McpServerForm`) are substantive implementations — no stubs. Template form and agent config correctly consume the new components, replacing raw JSON textareas with interactive editors. `testMcpConnectionAction` wired through to `validateMcpServerUrl`.

**Integration layer (plan 03):** `SyncFromTemplateDialog` shows live diff preview with friendly model names. `getTemplateDiffAction` and `syncFromTemplateAction` are both substantive Server Actions. Agent card and template list display friendly names. OpenClaw config fallback updated to `"claude-sonnet-4-6"`.

All requirement IDs (TMPL-01, TMPL-02, TMPL-03, TMPL-04) are satisfied by verified implementations. Commits e0c892e, f6d9a9c, d38885a, 0c24cde, 99f6da0, and 326aaf1 all exist in git history.

Human verification is flagged for UI rendering, interactive state changes, and live save behavior — none of which have indicators of failure in the code.

---

_Verified: 2026-03-29T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
