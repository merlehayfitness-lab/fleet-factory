# Phase 3: Deployment Pipeline - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can deploy a business's agent stack and the system generates all required artifacts (tenant config, docker-compose, env file, per-agent runtime configs) with versioning, retry, and rollback. Includes secrets management, integration adapter scaffolding with mock adapters, and a deployment center UI.

</domain>

<decisions>
## Implementation Decisions

### Deployment center UI
- Split view layout: left panel shows deployment list/history, right panel shows selected deployment details, artifacts, and logs
- Status shown as badge in the list view, stepper/progress bar (Queued -> Building -> Deploying -> Live) in the detail panel
- Generated artifacts (tenant-config.json, docker-compose, env, agent configs) viewable inline as code blocks with download buttons
- Each deployment entry in the list shows: version number, status badge, timestamp, agent count, trigger type (manual/auto), and config diff summary (what changed since last deploy)

### Deploy lifecycle UX
- Smart confirm: first deploy is one-click, redeploy over a live version shows confirmation dialog with diff of what changed
- Failed deployments show retry button with option to edit config before retrying (fix the issue first)
- Rollback: admin can pick any previous successful deployment from history to roll back to
- Error surfacing: each deployment stage (queued, building, deploying) shows pass/fail. Failed stage is expanded with error details and stack trace (error timeline pattern)

### Secrets & credentials
- Categorized form: secrets grouped by type (API keys, credentials, tokens) with labeled fields per integration
- Masked by default, "Show" eye icon reveals temporarily, auto-hides after 10 seconds
- Primary management in a business settings/secrets page, with quick-access link from the deployment center
- App-level encryption using AES-256 with an app-level key from env var. Never plaintext in the database.

### Integration adapters
- Integrations are configured per agent (agent-linked), not per business or department
- Per-agent config lives on a new "Integrations" tab on the agent detail page, plus a business-wide integrations overview page at /businesses/{id}/integrations
- Mock adapters (CRM, email, helpdesk, calendar, messaging) return realistic sample data so the UI shows something meaningful
- Swapping mock to real: dropdown selector per integration (Mock, Salesforce, HubSpot, etc.). Selecting a real provider shows credential fields.

### Claude's Discretion
- Stepper component design and animation
- Config diff algorithm and presentation in deployment list
- Error timeline visual design
- Auto-hide timing for secret reveal (10 seconds suggested, Claude can adjust)
- Mock data content (realistic fake contacts, emails, etc.)

</decisions>

<specifics>
## Specific Ideas

- Deployment center should feel like a CI/CD dashboard (Vercel deployments, Railway deployments) — clear status progression, version history, artifact inspection
- Error timeline inspired by GitHub Actions — each stage expandable, failed stage prominently red with details
- Secrets page should feel like Vercel environment variables — categorized, masked, reveal-on-click

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-deployment-pipeline*
*Context gathered: 2026-03-25*
