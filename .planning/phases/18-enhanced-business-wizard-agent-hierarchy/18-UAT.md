---
status: complete
phase: 18-enhanced-business-wizard-agent-hierarchy
source: [18-01-SUMMARY.md, 18-02-SUMMARY.md]
started: 2026-04-01T12:30:00Z
updated: 2026-04-01T13:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Department tree shows full hierarchy with tooltips
expected: Navigate to /businesses/new, advance to Departments step. Tree shows CEO + 5 departments (Marketing, Sales, Operations, Support, R&D) each with Director and specialists. All 24 agents pre-selected. Hovering a node shows tooltip with role, budget, model, description. Count reads "24 of 24 agents selected".
result: pass

### 2. CEO locked and cascade deselection
expected: CEO checkbox is always checked and disabled (cannot deselect). Uncheck a department head (e.g., Marketing Director) and all its specialists auto-deselect. Selection count decreases accordingly.
result: pass

### 3. Subdomain step validation and availability check
expected: On subdomain step, type an invalid slug like "-bad-" and see a format error. Type a valid slug and after ~500ms debounce, see a green checkmark (available) or red X (taken). Preview shows "yourslug.agencyfactory.ai".
result: pass

### 4. API key validation blocks on invalid key
expected: On API Keys step, enter a fake Anthropic key like "sk-ant-fake123". Click Next or Validate. Wizard blocks advancement and shows a validation error for the Anthropic key. Other providers are optional.
result: pass

### 5. DeepSeek available as 5th provider
expected: API Keys step shows 5 providers: Anthropic (required), OpenAI, Google AI, Mistral, and DeepSeek.
result: pass

### 6. Dynamic providers based on department selection
expected: Go back to Departments step, deselect all R&D agents (uncheck R&D Director). Advance to API Keys step. Only Anthropic should be listed (multi-model providers removed). Re-select R&D, advance again — OpenAI, Google, Mistral, DeepSeek reappear.
result: pass

### 7. Review step inline Edit buttons
expected: On the Review step (final step before submit), each section (Business Details, Departments, API Keys, Subdomain) has an Edit button. Clicking Edit on Departments navigates back to step 2. Clicking Edit on Subdomain navigates to the subdomain step.
result: pass

### 8. Full wizard submission redirects to deployments
expected: Complete the wizard with valid data and submit. Redirects to /businesses/[id]/deployments (not the business overview page).
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
