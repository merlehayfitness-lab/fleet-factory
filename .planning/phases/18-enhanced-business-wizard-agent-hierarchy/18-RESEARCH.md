# Phase 18: Enhanced Business Wizard & Agent Hierarchy - Research

**Researched:** 2026-04-01
**Status:** Ready for planning

## 1. Phase Requirements

### Requirement Definitions

| ID | Requirement | Source |
|----|-------------|--------|
| WIZ-01 | Wizard includes subdomain step with availability checking and preview (subdomain.fleetfactory.ai) | ROADMAP Phase 18 SC#1 |
| WIZ-02 | Wizard includes API keys step collecting Anthropic (required), OpenAI, Google, and Mistral keys with secure storage | ROADMAP Phase 18 SC#2 |
| WIZ-03 | Department tree selector shows hierarchical structure (CEO > Department Heads > Specialists) with expand/collapse and cascade selection | ROADMAP Phase 18 SC#3 |
| HIER-01 | Agent templates store role_level (0=C-suite, 1=dept head, 2=specialist), reporting_chain, token_budget, and parent_template_id | ROADMAP Phase 18 SC#4 |
| HIER-02 | Business subdomain is unique across all tenants (UNIQUE constraint enforced) | ROADMAP Phase 18 SC#5 |
| HIER-03 | Agent hierarchy is enforced during wizard selection (CEO required, deselecting head deselects children) | 18-CONTEXT decisions |

### User Decisions from 18-CONTEXT.md

1. **Step order:** Name -> Departments -> API Keys -> Subdomain -> Review -> Submit
2. **Strict linear flow:** Must complete each step before advancing, back button allowed
3. **Review step:** Shows all selections with inline editing
4. **Validate on advance:** Each step validates before proceeding (test API key, check subdomain)
5. **Wizard is create-only:** Editing happens on settings pages
6. **On submit:** Auto-start VPS deployment, redirect to deployments page
7. **Department tree:** Full hierarchy pre-selected by default, admin deselects what they don't need
8. **Tree nodes:** Show name only, details on hover (tooltip or panel)
9. **Deselecting head:** Auto-deselects all children
10. **CEO:** Always required, cannot be deselected
11. **Subdomain:** Default from slugified business name, debounced availability check (500ms)
12. **Custom domain:** Optional upgrade, noted but deferred
13. **API keys:** Anthropic required; others based on selected agents/features
14. **Key validation:** Live test call to each provider before advancing
15. **Key storage:** Existing secrets table with encryption (Phase 13 infrastructure)
16. **Contextual help text** per key field explaining what it powers

## 2. Current State of Implementation

### What Already Exists (Phase 18 is marked "complete" in ROADMAP)

The ROADMAP.md shows Phase 18 as already completed on 2026-03-31. The git status shows all key files exist as **untracked** (new files) or **modified** (existing files updated). This means Phase 18 code has been written but not yet committed to main.

**Existing files that implement Phase 18:**

| File | Status | Purpose |
|------|--------|---------|
| `apps/web/_components/create-business-wizard.tsx` | Modified | 5-step wizard: Business Details -> Departments -> API Keys -> Subdomain -> Review |
| `apps/web/_components/department-tree-select.tsx` | New (untracked) | Tree component with expand/collapse, cascade selection, role-level coloring |
| `apps/web/_components/wizard-api-keys-step.tsx` | New (untracked) | 4-provider API key collection (Anthropic required, OpenAI/Google/Mistral optional) |
| `apps/web/_components/wizard-subdomain-step.tsx` | New (untracked) | Subdomain input with .fleetfactory.ai suffix, debounced availability stub |
| `apps/web/_actions/business-actions.ts` | Modified | Added `createBusinessV2` server action |
| `packages/db/schema/042_expand_agent_templates.sql` | New | Adds role_level, reporting_chain, token_budget, parent_template_id, skills_package, mcp_servers |
| `packages/db/schema/043_businesses_subdomain.sql` | New | Adds subdomain column with UNIQUE constraint |
| `packages/db/schema/048_expand_departments_type.sql` | New | Extends department type CHECK to include marketing, rd, executive, hr |
| `packages/db/schema/049_seed_v2_templates.sql` | New | Seeds ~20 hierarchical templates: CEO + 4 dept heads + 14 specialists + 5 R&D |

### Code Analysis: What Is Implemented vs What Needs Work

#### create-business-wizard.tsx (512 lines)
- **IMPLEMENTED:** 5-step wizard (Business Details, Departments, API Keys, Subdomain, Review & Deploy)
- **IMPLEMENTED:** Step indicator navigation with validation gates
- **IMPLEMENTED:** Static DEPARTMENT_TEMPLATES array with 23 roles across 6 departments (executive, marketing, sales, operations, support, rd)
- **IMPLEMENTED:** DEFAULT_SELECTED set (CEO + 4 heads + key specialists = 12 agents)
- **IMPLEMENTED:** selectedTemplates state (Set<string>), apiKeys state, subdomain state
- **IMPLEMENTED:** Review step showing business summary, agents badges, API key summary, deployment checklist
- **IMPLEMENTED:** Deploy progress UI with animated status
- **IMPLEMENTED:** `createBusinessV2` form submission via FormData
- **GAP:** Templates are hardcoded in the component, not fetched from DB
- **GAP:** No inline editing on review step (user decisions say it should have inline editing)
- **GAP:** Step validation does not perform live API key testing (just length check)

#### department-tree-select.tsx (270 lines)
- **IMPLEMENTED:** Tree builder from flat template list using roleLevel grouping
- **IMPLEMENTED:** Expand/collapse per node
- **IMPLEMENTED:** Cascade selection: selecting head selects children, deselecting head deselects children
- **IMPLEMENTED:** CEO cannot be deselected (executive + roleLevel 0)
- **IMPLEMENTED:** Role-level color coding (amber for C-suite, blue for dept heads, slate for specialists)
- **IMPLEMENTED:** Token budget display per node and total summary
- **GAP:** No hover tooltip/panel for node details (description shown inline, not on hover per user decision)
- **GAP:** No summary of total selected count vs total available

#### wizard-api-keys-step.tsx (145 lines)
- **IMPLEMENTED:** 4 providers: Anthropic (required), OpenAI, Google, Mistral
- **IMPLEMENTED:** Show/hide toggle per key
- **IMPLEMENTED:** Contextual description per provider
- **IMPLEMENTED:** Required/Optional badges
- **GAP:** No live API key validation (just checks length > 10)
- **GAP:** No DeepSeek provider (R&D Council has a DeepSeek agent)
- **GAP:** Providers are static, not dynamically determined by selected departments

#### wizard-subdomain-step.tsx (118 lines)
- **IMPLEMENTED:** Input with .fleetfactory.ai suffix
- **IMPLEMENTED:** Auto-suggest from slug
- **IMPLEMENTED:** Manual edit override
- **IMPLEMENTED:** Debounced check (500ms setTimeout)
- **IMPLEMENTED:** Available/Taken badges
- **IMPLEMENTED:** URL preview
- **GAP:** Availability check is stubbed (always returns available) -- marked with TODO
- **GAP:** No real DB query for uniqueness check

#### business-actions.ts (createBusinessV2)
- **IMPLEMENTED:** Auth check, Zod validation of business details
- **IMPLEMENTED:** Calls `provisionBusinessTenant` RPC for atomic business creation
- **IMPLEMENTED:** Saves subdomain via Supabase update
- **IMPLEMENTED:** Saves API keys via `saveProviderCredentials` (encrypted)
- **IMPLEMENTED:** Allocates port block
- **IMPLEMENTED:** Conditional SSH deployment (if SSH is configured)
- **IMPLEMENTED:** Redirect to business overview on success
- **GAP:** Subdomain not validated for uniqueness before save (relies on DB UNIQUE constraint)
- **GAP:** selectedTemplateIds parsed but not used in provisioning RPC (RPC still creates default 4 departments)
- **GAP:** SSH deploy uses templateIds as agentIds (comment says "Will be resolved to real agent IDs")

#### Database Migrations
- **042:** Adds role_level, reporting_chain, token_budget, parent_template_id, skills_package, mcp_servers to agent_templates -- COMPLETE
- **043:** Adds subdomain TEXT UNIQUE to businesses -- COMPLETE
- **048:** Expands department type CHECK constraint to include marketing, rd, executive, hr -- COMPLETE
- **049:** Seeds ~23 V2 templates with full system prompts, skills_package, mcp_servers, token_budgets -- COMPLETE

### Provisioning RPC Gap

The existing `provision_business_tenant` RPC (migration 010) creates exactly 4 departments (Owner, Sales, Support, Operations) and matches templates by `department_type`. It does **not**:
- Accept a list of selected template IDs
- Create marketing, R&D, or executive departments
- Establish parent-child relationships between agents
- Set token budgets on agents from template defaults

The V2 wizard collects a set of selected template IDs, but the provisioning flow does not use them to determine which departments and agents to create. This is the largest architectural gap.

## 3. Dependencies and Infrastructure

### Phase 17 (Dependency)
Phase 17 (VPS Activation & Embedded Terminal) is complete. It established:
- SSH client (`packages/core/vps/ssh-client.ts`) with connection pooling
- SSH deployment (`packages/core/vps/ssh-deploy.ts`) with CEO-first ordering
- Port allocation (`packages/core/deployment/port-allocator.ts`) with 100-port blocks
- Provisioning scripts (`infra/vps/provision-tenant.sh`, `provision-designer.sh`)
- Embedded terminal page

### Secrets Infrastructure (Phase 13)
- `saveProviderCredentials()` encrypts and upserts credentials keyed by (business_id, provider, key)
- Auto-creates/activates integration record for the provider
- Existing `testConnection()` has mock success for all providers -- can be extended for real validation

### Existing Schema Constraints
- `businesses.subdomain` has UNIQUE constraint (migration 043) -- handles WIZ-01 / HIER-02
- `agent_templates.role_level` index exists (migration 042) -- supports HIER-01
- `departments.type` CHECK constraint expanded (migration 048) -- supports new department types

## 4. Technical Considerations

### Provisioning Architecture Options

The biggest technical question is how to bridge the wizard's template selection with the provisioning flow:

**Option A: Extend the RPC**
- Modify `provision_business_tenant` to accept `p_selected_templates uuid[]`
- RPC determines which departments to create based on template department_types
- Creates agents with parent-child relationships derived from template hierarchy
- Pros: Atomic, single transaction
- Cons: Complex PL/pgSQL, hard to debug

**Option B: Multi-step server action (current approach)**
- `createBusinessV2` already does post-RPC steps (subdomain, API keys, ports)
- Add department creation + agent creation steps after the base RPC call
- Use the selected template list to create departments for each unique department_type
- Create agents from templates with proper parent_agent_id resolution
- Pros: Simpler TypeScript logic, easier to debug
- Cons: Not fully atomic (but business is created atomically, agents are additive)

The current implementation follows Option B. The `createBusinessV2` action calls the RPC for base provisioning (business + 4 default departments + default agents) and then layers V2 features on top. This is the pragmatic choice given the existing codebase pattern.

### Subdomain Availability Check

Need a server action that queries:
```sql
SELECT EXISTS(SELECT 1 FROM businesses WHERE subdomain = $1)
```
Called from the subdomain step via debounced fetch. The UNIQUE constraint provides the final guard, but the UX requires pre-check feedback.

### API Key Validation

The user decisions require live API validation before advancing from the API Keys step. Options:
1. **Server action per provider** that makes a minimal API call (e.g., `GET /v1/models` for OpenAI, `POST /v1/messages` with tiny prompt for Anthropic)
2. **Batch validation** that tests all non-empty keys at once
3. **Phase 13's `testConnection()`** already exists as a mock -- extend it with real provider calls

Real validation adds latency (1-3s per provider). The user decision says "validate on advance" so this blocks the Next button until validation completes.

### Template-to-Agent Resolution

When creating agents from V2 templates:
1. Group selected templates by `departmentType`
2. For each unique department_type, create a department (if not already created by the base RPC)
3. Create agents in order: role_level 0 first (CEO), then 1 (heads), then 2 (specialists)
4. Set `parent_agent_id` by matching reporting_chain hierarchy:
   - CEO agent: parent = null
   - Dept head (e.g., "ceo.marketing"): parent = CEO agent
   - Specialist (e.g., "ceo.marketing.content"): parent = Marketing Director agent
5. Copy `token_budget`, `skills_package`, `mcp_servers` from template to agent

### Dynamic Provider Requirements

The user decision says "Departments step comes before API Keys so the system knows which providers are needed." When R&D department is selected, OpenAI, Google, Mistral, and DeepSeek keys become conditionally required/recommended. The wizard should derive required providers from the selected templates' `model_profile` field.

## 5. Key Files to Touch

### Must Modify
| File | Changes |
|------|---------|
| `apps/web/_components/create-business-wizard.tsx` | Template fetching from DB (or keep static), inline review editing |
| `apps/web/_components/wizard-subdomain-step.tsx` | Real availability check via server action |
| `apps/web/_components/wizard-api-keys-step.tsx` | Live validation, dynamic providers based on selection, DeepSeek |
| `apps/web/_components/department-tree-select.tsx` | Hover tooltip/panel for node details |
| `apps/web/_actions/business-actions.ts` | Subdomain check action, API key validation action, template-aware provisioning |

### Must Add/Verify
| File | Purpose |
|------|---------|
| `packages/db/schema/042_expand_agent_templates.sql` | Already exists, verify applied |
| `packages/db/schema/043_businesses_subdomain.sql` | Already exists, verify applied |
| `packages/db/schema/048_expand_departments_type.sql` | Already exists, verify applied |
| `packages/db/schema/049_seed_v2_templates.sql` | Already exists, verify applied |

### Existing Infrastructure (No Changes Needed)
| File | Role |
|------|------|
| `packages/core/secrets/service.ts` | `saveProviderCredentials()` -- encryption + upsert |
| `packages/core/deployment/port-allocator.ts` | Port block allocation for VPS |
| `packages/core/vps/ssh-deploy.ts` | SSH deployment with CEO-first ordering |
| `packages/core/tenant/provision.ts` | Base provisioning RPC wrapper |

## 6. Gaps Between Implementation and User Decisions

| Gap | User Decision | Current State | Effort |
|-----|---------------|---------------|--------|
| Subdomain availability check | Real debounced DB check | Stub (always returns true) | Small -- add server action |
| API key live validation | Test API call per provider | Length check only | Medium -- add provider-specific test calls |
| Dynamic provider list | Providers based on selected departments | Static 4 providers | Medium -- derive from template model_profile |
| DeepSeek provider | R&D Council uses DeepSeek | Not in API_KEY_PROVIDERS list | Small -- add entry |
| Inline review editing | Quick changes on review step | View-only summary | Medium -- add edit triggers per section |
| Hover tooltips on tree | Name only visible, details on hover | Description shown inline | Small -- move details to tooltip |
| Template-aware provisioning | Only create selected departments/agents | RPC creates default 4 departments | Large -- extend createBusinessV2 |
| Redirect target | Redirect to deployments page | Redirects to business overview | Trivial -- change path |

## 7. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provisioning RPC doesn't support V2 template selection | Wizard deploys but creates wrong agent set | Extend createBusinessV2 to create V2 departments/agents after base provisioning |
| Live API key validation latency | Slow wizard advancement | Show loading spinner, test in parallel, cache results |
| Subdomain race condition | Two wizards claim same subdomain | UNIQUE constraint handles final guard; availability check is best-effort |
| Template data drift | Hardcoded templates in wizard vs DB templates | Either fetch from DB or accept static array as source of truth for wizard |
| SSH deploy with unresolved agent IDs | Deploy fails or targets wrong containers | Resolve real agent IDs after provisioning, before SSH deploy |

## 8. Suggested Plan Structure

Given the existing code, this phase is largely about **closing gaps** between the implemented wizard and the user decisions. The migrations and UI components exist; the gaps are in server-side validation, template-aware provisioning, and UX polish.

**Plan 1: Server-side validation and provisioning**
- Add `checkSubdomainAvailability` server action (real DB query)
- Add `validateApiKey` server action (per-provider test calls)
- Extend `createBusinessV2` to create V2 departments and agents from selected templates
- Wire subdomain check in wizard-subdomain-step.tsx

**Plan 2: Wizard UX polish**
- Add DeepSeek to API key providers
- Dynamic provider list based on selected departments
- Hover tooltip/panel on department tree nodes
- Inline editing on review step
- Redirect to deployments page after submit

**Plan 3: Verification and migration application**
- Verify all 4 migrations applied to Supabase
- End-to-end test: create business with full V2 wizard flow
- Verify agents created with correct hierarchy (parent_agent_id chain)
- Verify subdomain uniqueness enforcement

## 9. Patterns to Follow

Based on accumulated project decisions from STATE.md:

- **Server Actions pattern:** Thin actions (< 20 lines), delegate to core services
- **Validation pattern:** Zod schemas with `.safeParse()`, errors returned as `{ error: string }`
- **Supabase pattern:** Authenticated client from `createServerClient()`, check user before operations
- **Encryption pattern:** `saveProviderCredentials()` from Phase 13 handles encrypt + upsert
- **SSH deploy pattern:** Dynamic import to avoid webpack bundling node-ssh (`await import(...)`)
- **redirect() safety:** Never inside try/catch (throws NEXT_REDIRECT internally)
- **Debounce pattern:** 500ms setTimeout with cleanup (matches subdomain step pattern)
- **State management:** useState for local wizard state, FormData for submission
- **Error handling:** Non-critical operations wrapped in try/catch with fallback, critical operations return error objects
- **Audit logging:** Best-effort (try/catch, log but don't throw)

---

*Phase: 18-enhanced-business-wizard-agent-hierarchy*
*Research completed: 2026-04-01*
