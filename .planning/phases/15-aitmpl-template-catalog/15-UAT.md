---
status: resolved
phase: 15-aitmpl-template-catalog
source: 15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md
started: 2026-03-30T17:00:00Z
updated: 2026-03-30T18:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dashboard AITMPL Suggestion Banner
expected: Navigate to a business dashboard. An AITMPL suggestion banner appears between VPS warnings and stats cards, with a Sparkles icon, descriptive text, and a "Browse Catalog" button.
result: pass

### 2. Banner Dismiss Persistence
expected: Click the dismiss/close button on the AITMPL banner. Refresh the page. The banner should remain dismissed (persisted via localStorage).
result: issue
reported: "the banner is persisting"
severity: major

### 3. Browse AITMPL on Agent Skills Tab
expected: Navigate to any agent's detail page, go to the Skills tab. A "Browse AITMPL" button should be visible alongside the existing skill template browser button.
result: pass

### 4. AITMPL Catalog Browser Dialog
expected: Click "Browse AITMPL" on the Skills tab. A dialog opens showing 7 type tabs (skill, command, setting, hook, agent, mcp, plugin), a search input, category dropdown, sort selector, and a card grid with download counts and department recommendation badges.
result: pass

### 5. Catalog Search & Filtering
expected: In the catalog browser, type a search term. Results should filter after a short debounce. Switching tabs changes the type filter. Category dropdown and sort options should update results.
result: pass

### 6. Import Skill with Target Picker
expected: Select a skill in the catalog browser, click Import. A target picker dialog appears letting you choose which agent and department to assign the imported skill to. After confirming, the skill is imported.
result: issue
reported: "works but not friendly names - also would be nice to search/filter overall applied skill if there is a lot"
severity: minor

### 7. Browse AITMPL MCPs on Agent Config Tab
expected: Navigate to an agent's Config tab, find the Tool Profile section. A "Browse AITMPL MCPs" button should be visible. Clicking it opens the catalog browser defaulting to the MCP tab.
result: pass

### 8. Browse AITMPL Skills in Skill Template Browser
expected: Open the Skill Template Browser (from Skills management). A "Browse AITMPL Skills" button should be visible. Clicking it opens the AITMPL catalog browser as a layered dialog.
result: pass

## Summary

total: 8
passed: 6
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Banner dismiss state persists via localStorage after page refresh"
  status: resolved
  reason: "User reported: the banner is persisting"
  severity: major
  test: 2
  root_cause: "businessId may be undefined/empty on first render, causing useEffect to read/write localStorage with degenerate key 'aitmpl-banner-dismissed-undefined' — subsequent renders with real businessId find no stored value and show banner again"
  artifacts:
    - path: "apps/web/_components/aitmpl-suggestion-banner.tsx"
      issue: "No guard on businessId validity before constructing localStorage key in useEffect and dismiss handler"
  missing:
    - "Add if (!businessId) return guard at top of useEffect"
    - "Add if (!businessId) return guard in dismiss handler"

- truth: "Target picker shows friendly agent/department names in dropdown"
  status: resolved
  reason: "User reported: works but not friendly names - also would be nice to search/filter overall applied skill if there is a lot"
  severity: minor
  test: 6
  root_cause: "skills/page.tsx does not fetch agents/departments — SkillLibrary receives no agents prop — SkillTemplateBrowser gets agents=[] — target picker SelectItem renders no children, fallback shows raw UUID from value attribute"
  artifacts:
    - path: "apps/web/app/(dashboard)/businesses/[id]/skills/page.tsx"
      issue: "Does not fetch agents or departments from Supabase"
    - path: "apps/web/_components/skill-library.tsx"
      issue: "Does not accept or forward agents/departments props to SkillTemplateBrowser"
  missing:
    - "Fetch agents (with departments join) and departments in skills/page.tsx"
    - "Pass agents and departments props through SkillLibrary to SkillTemplateBrowser"
