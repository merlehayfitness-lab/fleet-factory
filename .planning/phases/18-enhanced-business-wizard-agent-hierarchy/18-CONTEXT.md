# Phase 18: Enhanced Business Wizard & Agent Hierarchy - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Business creation wizard collects subdomain, API keys, and lets admin select from a hierarchical department tree with role levels, reporting chains, and token budgets per agent. This phase covers the wizard flow, department tree component, subdomain setup, and API key collection. Post-creation config changes (settings pages triggering redeploy) are part of the settings/deployment pipeline, not this phase.

</domain>

<decisions>
## Implementation Decisions

### Wizard Flow & Steps
- Step order: Name → Departments → API Keys → Subdomain → Review → Submit
- Strict linear flow — must complete each step before advancing, back button allowed but no skipping ahead
- Review step shows all selections with inline editing (quick changes without navigating back)
- Validate on advance — each step validates before letting user proceed (e.g., test API key, check subdomain availability)
- Wizard is create-only — editing happens on business settings/config pages
- Config changes on settings pages should auto-trigger redeployment and health verification (not this phase, but noted for downstream)
- On submit, auto-start VPS deployment (departments/agents are fully configured during wizard)
- After submit, redirect to deployment status page (/businesses/[id]/deployments) showing live progress

### Department Tree Selection
- Full hierarchy pre-selected by default — CEO + all 4 department leads + all sub-agents; admin deselects what they don't need
- Tree nodes show name only — role, budget, model details appear on hover (tooltip or panel)
- Deselecting a department lead auto-deselects all its children (can't have sub-agents without a lead)
- CEO is always required and cannot be deselected
- No token budget summary needed — individual budgets visible on hover is enough

### Subdomain & Routing
- Every business gets a default subdomain: slug.fleetfactory.ai (always works)
- Custom domain support as optional upgrade (e.g., agents.acme.com)
- Auto-suggest subdomain from slugified business name (e.g., "Acme Corp" → acme-corp), user can edit
- Real-time debounced availability check (500ms) — green checkmark or red X
- Subdomain must be unique across all tenants (UNIQUE constraint enforced in DB)

### API Keys & Security
- Anthropic key required; other providers collected based on what the selected agents/features need (e.g., R&D Council needs OpenAI, Google, Mistral, DeepSeek)
- Live validation — test API call to each provider to verify key works before advancing
- Stored in existing secrets table with encryption (Phase 13 infrastructure)
- Contextual help text per key field explaining what it powers (e.g., "Powers your Sales and Support agents", "Required for R&D Council debates")

### Claude's Discretion
- Exact tooltip/hover panel design for department tree nodes
- Debounce timing for subdomain check (500ms suggested)
- Error state UX for failed API key validation
- Review step layout and inline edit UX
- Which providers are "required" vs "optional" based on selected departments (determine from template configs)

</decisions>

<specifics>
## Specific Ideas

- Departments step comes before API Keys so the system knows which providers are needed based on selected agents
- Auto-deploy after wizard means the wizard must collect everything needed for a complete deployment — no "configure later" for required fields
- "Get one working, then replicate" VPS architecture (Phase 29) depends on the wizard producing a complete agent config

</specifics>

<deferred>
## Deferred Ideas

- Custom domain DNS verification and SSL provisioning — future phase or part of Phase 30 (Hardening)
- Settings page auto-redeploy on config change — separate from wizard, involves deployment pipeline
- White-label portal branding per business — Theme A future work

</deferred>

---

*Phase: 18-enhanced-business-wizard-agent-hierarchy*
*Context gathered: 2026-04-01*
