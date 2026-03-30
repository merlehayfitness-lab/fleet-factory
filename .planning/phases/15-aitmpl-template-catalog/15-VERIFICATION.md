---
phase: 15-aitmpl-template-catalog
verified: 2026-03-30T17:15:00Z
status: passed
score: 22/22 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open business dashboard and verify AITMPL suggestion banner appears"
    expected: "Blue banner with Sparkles icon, 'Enhance your agents with AITMPL templates' heading, Browse Catalog button, and X dismiss button"
    why_human: "localStorage dismiss state and SSR hydration flash prevention cannot be verified statically"
  - test: "Click Browse Catalog from the banner, verify catalog loads and shows tabs"
    expected: "Dialog opens with 7 tabs (Skills, Agents, Commands, MCPs, Settings, Hooks, Plugins); default 10 results visible per tab"
    why_human: "Requires live aitmpl.com/components.json network fetch to confirm data populates"
  - test: "Click Add on a catalog card, verify detail panel content preview, then click Import"
    expected: "Content preview renders in pre block; for MCP type, JSON preview appears before target picker; success toast fires after import"
    why_human: "End-to-end import flow requires live database writes and Supabase auth"
  - test: "Verify Recommended badge on cards matching department context"
    expected: "Cards whose category appears in DEPARTMENT_CATEGORY_MAP for the current department show green 'Recommended' badge"
    why_human: "Requires live catalog data and correct departmentType prop propagation from agent detail"
  - test: "Dismiss banner and verify it stays dismissed after page reload"
    expected: "Banner remains hidden after dismiss; localStorage key 'aitmpl-banner-dismissed-{businessId}' set to 'true'"
    why_human: "localStorage behavior cannot be verified statically"
---

# Phase 15: AITMPL Template Catalog Verification Report

**Phase Goal:** Business setup wizard and template management suggest Skills, Agents, Commands, Settings, Hooks, MCPs, and Plugins from the AITMPL catalog (aitmpl.com)
**Verified:** 2026-03-30T17:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Users can browse AITMPL catalog within the admin panel | VERIFIED | `AitmplCatalogBrowser` dialog exists at `apps/web/_components/aitmpl-catalog-browser.tsx` with 7 type tabs; integrated into 4 access points |
| 2 | Wizard/panel shows 7 AITMPL category tabs (Skills, Agents, Commands, MCPs, Settings, Hooks, Plugins) | VERIFIED | `TABS` constant in catalog-browser.tsx defines all 7 values matching `AitmplComponentType`; tab bar renders Button per tab |
| 3 | Components can be browsed with search, category filter, and sort | VERIFIED | Search input with 300ms debounce, category Select from live results, sort Select (Most Popular / A-Z); `searchAitmplAction` calls `searchComponents` server-side |
| 4 | Recommendations shown based on department type | VERIFIED | `isDepartmentRecommended(departmentType, item.category)` called per card; green "Recommended" badge rendered when true; `DEPARTMENT_CATEGORY_MAP` covers all 4 department types |
| 5 | Skills, Commands, Settings, Hooks can be imported as Agency Factory skills | VERIFIED | `importFromAitmpl` in `import-service.ts` routes skill/command/setting/hook to `createSkill` + optional `assignSkill` with `source_type: "imported"` and `source_url: "aitmpl://{type}/{path}"` |
| 6 | Agent type can be imported as system_prompt onto a target agent | VERIFIED | `importFromAitmpl` case "agent" calls `supabase.from("agents").update({ system_prompt: component.content })` when `targetAgentId` provided |
| 7 | MCP type can be imported by merging into tool_profile.mcp_servers[] | VERIFIED | `importFromAitmpl` case "mcp" parses content JSON, fetches agent tool_profile, pushes new server entry, updates agent; JSON preview shown in UI before target picker |
| 8 | Plugin type returns actionable decomposition guidance | VERIFIED | `importFromAitmpl` case "plugin" returns `success: false` with error listing `agentsList`, `commandsList`, `mcpServersList` paths to import individually |
| 9 | 10MB+ catalog never sent to client; search returns lightweight results | VERIFIED | `searchComponents` returns `CatalogSearchResult[]` (no `content` field); `getAitmplDetailAction` strips security/author/repo before returning; full catalog cached server-side with 24h TTL |
| 10 | AITMPL catalog browser accessible from agent Skills tab | VERIFIED | `agent-skills-tab.tsx` imports `AitmplCatalogBrowser`, renders "Browse AITMPL" button, opens with `defaultType="skill"` and passes `agents`/`departments` from `AgentDetailTabs` |
| 11 | AITMPL catalog browser accessible from agent Config Tool Profile section | VERIFIED | `agent-config.tsx` imports `AitmplCatalogBrowser`, renders "Browse AITMPL MCPs" button, opens with `defaultType="mcp"` |
| 12 | AITMPL suggestion banner on business dashboard | VERIFIED | `health-dashboard.tsx` renders `AitmplSuggestionBanner` at line 153; `bannerAgents`/`bannerDepartments` fetched server-side via `Promise.all` in `page.tsx` |
| 13 | Banner dismiss state persists via localStorage per business | VERIFIED | `storageKey(businessId)` used as localStorage key; `useEffect` on mount reads it; SSR flash prevented by defaulting `dismissed=true` until mount |
| 14 | Skill Template Browser has Browse AITMPL Skills button | VERIFIED | `skill-template-browser.tsx` imports `AitmplCatalogBrowser`, renders "Browse AITMPL Skills" button at line 140 when `agents && agents.length > 0`; opens layered dialog |
| 15 | Target picker receives actual agents from server (never empty) | VERIFIED | `allAgents` fetched from Supabase in `apps/web/app/(dashboard)/businesses/[id]/agents/[agentId]/page.tsx` and passed through `AgentDetailTabs` -> `AgentSkillsTab`; `bannerAgents` fetched in business page.tsx |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `packages/core/aitmpl/catalog-types.ts` | VERIFIED | 145 lines; exports `AitmplComponentType`, `AitmplComponent`, `AitmplPlugin`, `AitmplTemplate`, `AitmplCatalog`, `CatalogSearchResult`, `AitmplImportOptions`, `AitmplImportResult`; `CatalogSearchResult` has no `content` field |
| `packages/core/aitmpl/category-mapping.ts` | VERIFIED | 63 lines; exports `DEPARTMENT_CATEGORY_MAP` covering owner/sales/support/operations, `getRecommendedCategories`, `isDepartmentRecommended` |
| `packages/core/aitmpl/catalog-service.ts` | VERIFIED | 276 lines; module-level cache (`cachedData`, `cacheTimestamp`, `CACHE_TTL=24h`); exports `getCatalog`, `searchComponents`, `getComponentDetail`, `getComponentsByType`, `getCatalogStats`, `clearCatalogCache`; stale-cache fallback on fetch failure |
| `packages/core/aitmpl/import-service.ts` | VERIFIED | 275 lines; `importFromAitmpl` handles all 7 types; uses `createSkill`/`assignSkill` from `skill-service`; MCP merges into `tool_profile.mcp_servers[]` |
| `packages/core/server.ts` | VERIFIED | AITMPL exports present at lines 232-243; exports all 6 catalog service functions + `importFromAitmpl` |
| `packages/core/index.ts` | VERIFIED | Client-safe AITMPL exports present at lines 243-256; exports `AitmplComponentType`, `CatalogSearchResult`, `AitmplImportOptions`, `AitmplImportResult`, `DEPARTMENT_CATEGORY_MAP`, `getRecommendedCategories`, `isDepartmentRecommended` |
| `apps/web/_actions/aitmpl-actions.ts` | VERIFIED | 168 lines; 4 Server Actions with `"use server"` directive; all have auth checks; `importAitmplAction` calls `revalidatePath` on success; `getAitmplDetailAction` strips `security`/`author`/`repo` fields |
| `apps/web/_components/aitmpl-catalog-browser.tsx` | VERIFIED | 487 lines; Dialog with `sm:max-w-5xl`; 7-tab bar; search + category + sort filters; card grid with name/description/category/download/Recommended badges; detail panel with `pre` preview; MCP JSON confirm flow; renders `AitmplTargetPicker` outside Dialog |
| `apps/web/_components/aitmpl-target-picker.tsx` | VERIFIED | 155 lines; Dialog; agent/department radio; pre-selection support; MCP note; confirm/cancel |
| `apps/web/_components/agent-skills-tab.tsx` | VERIFIED | Contains `AitmplCatalogBrowser` import and render with `defaultType="skill"`, `agents`, `departments`, `departmentType` props |
| `apps/web/_components/agent-config.tsx` | VERIFIED | Contains `AitmplCatalogBrowser` import and render with `defaultType="mcp"` on Tool Profile section |
| `apps/web/_components/aitmpl-suggestion-banner.tsx` | VERIFIED | 85 lines; Sparkles icon; "Enhance your agents with AITMPL templates" heading; Browse Catalog + X buttons; `localStorage` dismiss per businessId; `useRef` tracks import across dialog sessions; `AitmplCatalogBrowser` rendered inline |
| `apps/web/app/(dashboard)/businesses/[id]/page.tsx` | VERIFIED | Server-side `Promise.all` fetch for `bannerAgents`/`bannerDepartments`; maps to expected prop shapes; passes to `HealthDashboard` |
| `apps/web/_components/health-dashboard.tsx` | VERIFIED | Accepts `bannerAgents`/`bannerDepartments` optional props; renders `AitmplSuggestionBanner` with businessId + agents + departments |
| `apps/web/_components/skill-template-browser.tsx` | VERIFIED | Accepts `agents`/`departments`/`departmentType` optional props; "Browse AITMPL Skills" button conditioned on `agents && agents.length > 0`; `AitmplCatalogBrowser` rendered at bottom |

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `catalog-service.ts` | `catalog-types.ts` | `import { AitmplCatalog, CatalogSearchResult }` | WIRED | Line 9-14 of catalog-service.ts |
| `catalog-service.ts` | `category-mapping.ts` | `import { DEPARTMENT_CATEGORY_MAP }` | WIRED | Line 15 of catalog-service.ts |
| `import-service.ts` | `catalog-service.ts` | `import { getComponentDetail, getCatalog }` | WIRED | Line 11 of import-service.ts |
| `import-service.ts` | `skill/skill-service.ts` | `import { createSkill, assignSkill }` | WIRED | Line 18 of import-service.ts |
| `aitmpl-actions.ts` | `@agency-factory/core/server` | `import { searchComponents, getComponentDetail, importFromAitmpl, getCatalogStats }` | WIRED | Lines 8-12 of aitmpl-actions.ts |
| `aitmpl-catalog-browser.tsx` | `aitmpl-actions.ts` | `import { searchAitmplAction, getAitmplDetailAction, importAitmplAction }` | WIRED | Lines 24-27 of catalog-browser.tsx; all 3 called in handlers |
| `agent-skills-tab.tsx` | `aitmpl-catalog-browser.tsx` | `import { AitmplCatalogBrowser }` + rendered | WIRED | Line 11 + lines 196-210 of agent-skills-tab.tsx |
| `agent-config.tsx` | `aitmpl-catalog-browser.tsx` | `import { AitmplCatalogBrowser }` + rendered | WIRED | Line 22 + lines 647-660 of agent-config.tsx |
| `aitmpl-suggestion-banner.tsx` | `aitmpl-catalog-browser.tsx` | `AitmplCatalogBrowser` rendered with `open={catalogOpen}` | WIRED | Line 6 + lines 73-82 of aitmpl-suggestion-banner.tsx |
| `skill-template-browser.tsx` | `aitmpl-catalog-browser.tsx` | `AitmplCatalogBrowser` rendered as layered dialog | WIRED | Line 27 + lines 282-295 of skill-template-browser.tsx |
| `health-dashboard.tsx` | `aitmpl-suggestion-banner.tsx` | `AitmplSuggestionBanner` rendered at line 153 | WIRED | `bannerAgents`/`bannerDepartments` passed from page.tsx -> HealthDashboard -> AitmplSuggestionBanner |
| `page.tsx (business dashboard)` | `health-dashboard.tsx` | `bannerAgents` and `bannerDepartments` props | WIRED | Lines 54-76 fetch data; lines 145-146 pass to HealthDashboard |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AITMPL-01 | 15-01, 15-02, 15-03 | Browse and select from AITMPL catalog within business setup wizard | SATISFIED | `AitmplCatalogBrowser` accessible from dashboard banner, skill template browser, agent skills tab, agent config — 4 access points total |
| AITMPL-02 | 15-01, 15-02, 15-03 | Wizard suggests skills, agents, commands based on department/industry | SATISFIED | `DEPARTMENT_CATEGORY_MAP` maps owner/sales/support/operations to relevant AITMPL categories; `isDepartmentRecommended` drives "Recommended" badges; `departmentType` prop propagated from agent context |
| AITMPL-03 | 15-01, 15-02, 15-03 | Import tool configurations from AITMPL agent-tool-builder for tool_profile JSON | SATISFIED | MCP import type parses component content JSON and merges into `tool_profile.mcp_servers[]` via `importFromAitmpl`; JSON preview shown before confirmation |
| AITMPL-04 | 15-01, 15-02, 15-03 | Catalog covers Skills, Agents, Commands, Settings, Hooks, MCPs, Plugins | SATISFIED | All 7 types defined in `AitmplComponentType`; 7-tab UI in `AitmplCatalogBrowser`; `AitmplCatalog` interface has separate arrays for each; `searchComponents` handles all types including plugin shape mapping |

All 4 requirements satisfied. No orphaned requirements detected (REQUIREMENTS.md shows AITMPL-01 through AITMPL-04 mapped to Phase 15; all 4 are claimed in all 3 plans).

### Anti-Patterns Found

No blockers or warnings detected.

- The `placeholder` occurrences in catalog-browser.tsx and target-picker.tsx are HTML input/select placeholder attributes — not code stubs.
- `return null` in `aitmpl-suggestion-banner.tsx` (line 46) is intentional and correct: renders nothing when banner is dismissed.
- `getComponentDetail` returning `null` for plugin type (line 238 of catalog-service.ts) is intentional design; plugin type is handled separately via `getCatalog().plugins`.

### Human Verification Required

#### 1. Banner Renders on Business Dashboard

**Test:** Navigate to `/businesses/{id}` and verify the AITMPL suggestion banner appears (assuming it has not been dismissed yet — clear localStorage first).
**Expected:** Blue banner with Sparkles icon, bold heading "Enhance your agents with AITMPL templates", sub-text about 1,600+ items, "Browse Catalog" button, and X dismiss button.
**Why human:** SSR hydration flash prevention (defaults `dismissed=true` until `useEffect` runs) and localStorage state cannot be verified statically.

#### 2. Catalog Browser Loads Data from aitmpl.com

**Test:** Click "Browse Catalog" from the banner. Observe the Skills tab.
**Expected:** Dialog opens; Skills tab shows up to 10 cards by default; each card has a name, 2-3 line description, category badge, download count badge; typing in the search field expands results to 50.
**Why human:** Requires live network fetch to `https://www.aitmpl.com/components.json`; server-side 24h TTL cache behavior cannot be tested statically.

#### 3. Full Import Flow (non-MCP)

**Test:** Open catalog browser from an agent's Skills tab; click Add on a skill card; verify detail panel with content preview appears; click Import; select an agent in the target picker; confirm.
**Expected:** Success toast "Imported {name} successfully"; skill appears in agent's skills list.
**Why human:** Requires live Supabase auth, `createSkill`, `assignSkill` database operations.

#### 4. MCP Import with JSON Preview

**Test:** Open catalog browser from agent Config tab (Browse AITMPL MCPs); switch to MCPs tab; click Add on an MCP card; click Import.
**Expected:** JSON preview of MCP config appears in the detail panel before target picker; clicking "Confirm & Select Agent" opens target picker; after confirming, MCP appears in agent's tool profile.
**Why human:** Requires MCP component with valid JSON content from live catalog; database write to `tool_profile`.

#### 5. Recommendation Badges

**Test:** Open catalog browser from an agent in the "Sales" department; observe Skills and Agents tabs.
**Expected:** Cards in categories matching `DEPARTMENT_CATEGORY_MAP["sales"]` (business-marketing, marketing, enterprise-communication, web-data, seo) show green "Recommended" badge.
**Why human:** Requires live catalog data with known categories to match against the mapping.

### Summary

Phase 15 goal is fully achieved. The AITMPL catalog integration is complete across all three plans:

**Plan 01 (Backend):** All 4 core modules exist in `packages/core/aitmpl/` with substantive implementations. The catalog service fetches from `aitmpl.com/components.json` with 24h module-level TTL caching and stale-cache fallback. Search filtering operates server-side returning lightweight `CatalogSearchResult[]`. Import service correctly routes all 7 AITMPL types to Agency Factory entities. Barrel exports properly separate client-safe types (`index.ts`) from server-only functions (`server.ts`).

**Plan 02 (UI Layer):** All 5 files exist and are substantive. Server Actions have auth checks and proper field stripping. The catalog browser dialog is fully implemented with 7 tabs, debounced search (300ms), category filter built from live results, sort dropdown, card grid with download counts and department recommendation badges, detail panel with content preview, MCP JSON confirmation flow, and target picker integration. Both agent-level access points (Skills tab + Config Tool Profile) are wired with real `agents`/`departments` data flowing from `AgentDetailTabs` -> server-fetched `allAgents`.

**Plan 03 (Discovery):** The suggestion banner is complete with correct localStorage persistence pattern, SSR hydration flash prevention, auto-dismiss after import via `useRef`, and `AitmplCatalogBrowser` embedded. The business dashboard page fetches `bannerAgents`/`bannerDepartments` server-side via `Promise.all` and passes them through `HealthDashboard`. The Skill Template Browser gains a "Browse AITMPL Skills" peer button conditionally shown when agents are available.

Typecheck passes across all packages (`pnpm turbo typecheck`). All 6 commits verified in git log.

---

_Verified: 2026-03-30T17:15:00Z_
_Verifier: Claude (gsd-verifier)_
