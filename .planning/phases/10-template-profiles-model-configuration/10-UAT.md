---
status: complete
phase: 10-template-profiles-model-configuration
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md
started: 2026-03-29T16:30:00Z
updated: 2026-03-29T16:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Model Dropdown on Template Form
expected: Template form shows a model dropdown with friendly Claude names grouped by tier instead of raw JSON textarea. Selecting a model updates the model_profile.
result: pass

### 2. Model Dropdown on Agent Config
expected: Agent detail > Config tab shows an interactive model dropdown (not static read-only JSON). Changing the model saves immediately and shows a redeploy toast with link to deployments page.
result: pass

### 3. Tool Profile Summary Card on Template Form
expected: Template form shows a tool profile summary card with tool names as badges (up to 5, then +N overflow) and an Edit button that opens a side panel drawer.
result: pass

### 4. Profile Editor Drawer (Form Mode)
expected: Clicking Edit on tool profile opens a fixed-position side drawer. Form mode shows: tool allowlist with add/remove badges, MCP server list with "Add MCP Server" button that shows a catalog of known servers to pick from.
result: pass

### 5. Profile Editor Drawer (JSON Toggle)
expected: In the profile editor drawer, toggling to JSON mode shows the raw JSON with syntax validation. If JSON is invalid, switching back to form mode is blocked with an error message.
result: pass

### 6. MCP Server Configuration
expected: Adding an MCP server from the catalog populates its config fields. The form shows name, URL, transport type, environment variables, and a Test Connection button (for HTTP/SSE servers).
result: pass

### 7. Department Default Auto-Switch
expected: On template form, changing the department type auto-switches model and tool defaults. E.g., switching to "Owner" sets model to Opus, switching to "Support" sets model to Haiku.
result: pass

### 8. Sync from Template Dialog
expected: On agent config, clicking "Sync from Template" shows a dialog with side-by-side diff of agent vs template profiles (model and tools). If no changes, shows "in sync" message. If changes exist, confirm button overwrites agent profiles and shows redeploy toast.
result: pass

### 9. Friendly Model Names on Agent Cards
expected: Agent cards in the agents list show friendly model names (e.g., "Claude Opus 4.6") instead of raw model IDs or empty JSON.
result: pass

### 10. Friendly Model Names on Template List
expected: Template list cards show friendly model name and tool/MCP server counts (e.g., "3 tools, 1 MCP server").
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
