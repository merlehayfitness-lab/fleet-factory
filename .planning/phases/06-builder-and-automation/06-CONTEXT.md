# Phase 6: Builder and Automation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Claude-powered builder service that generates agent configs and deployment artifacts from templates, with version tracking, security validation, and cross-tenant template rollout. This phase does NOT add new agent capabilities, task routing, or observability features.

</domain>

<decisions>
## Implementation Decisions

### Builder interaction model
- Natural language prompt interface — admin describes what they want, Claude interprets and generates configs
- Builder lives inside the deployment flow as a step (not a standalone page)
- Required for new agents, optional for redeployments
- Claude receives full tenant state as context: business info, departments, existing agents, integrations, deployment history
- Per-agent generation — each agent config is generated individually with its own prompt
- Conversational thread per agent — admin can say "make it more concise" and Claude iterates on previous output
- Threads persist across sessions in the database — admin can return days later and continue refining
- Claude returns config + reasoning — generated config AND a brief explanation of why it chose those values
- Both agent configs AND deployment artifacts generated via Claude with creative latitude (not strict template substitution)
- Admin can paste example interactions, brand guidelines, or reference text to guide Claude's generation
- Generated configs are saved immediately (no dry-run preview step)

### Generation review flow
- Side-by-side diff view: current config vs generated config — admin sees exactly what changed
- Admin can both edit inline AND ask Claude to regenerate via the conversational thread
- Three actions available: Accept, Regenerate, Discard
- Security validation results shown inline in the diff view as warnings/flags — admin sees problems before accepting

### Template versioning & rollout
- Semantic versioning (v1.0.0, v1.1.0, v2.0.0) for template versions
- New tenants automatically get the latest template version; existing tenants keep their current version
- Dashboard indicator for existing tenants when a newer template version is available ("Newer template available for Sales agent (v1.0 -> v1.2)")
- Templates are forkable per tenant — a tenant can fork a global template and maintain their own version
- Forked templates track upstream: show "upstream has updates" with selective merge capability
- Platform admin only can create/update global templates — tenants consume or fork
- Upgrading an existing tenant's agent to a newer template version opens the builder with the new template — admin can adjust the prompt before regenerating

### Validation & safety
- Auto-fix and notify — Claude automatically corrects security issues and shows what it changed
- Validation checks both tool allowlist AND prompt safety (injection risks, credential leaks, overly permissive instructions)
- Prompt safety scanning is Claude-powered (AI-based analysis, not just regex)
- Full audit trail — every validation run logged: what was checked, what passed/failed, what was auto-fixed, who accepted
- Global baseline allowlist that all tenants inherit, plus per-tenant additions for tenant-specific tools
- Validation results live inline in audit logs (no separate validation page)
- Builder API calls tracked per tenant with token count and estimated cost

### Claude's Discretion
- Version diff presentation format (full config diff vs categorized changes)
- Whether security auto-fixes can be undone (with appropriate warnings/audit logging)
- Whether deployment is blocked or allows override when validation warnings exist
- Exact inline warning styling and severity indicators in the diff view

</decisions>

<specifics>
## Specific Ideas

- Builder should feel conversational — admin describes what they want for an agent, Claude generates, admin refines through back-and-forth
- The diff view should make it obvious what Claude changed and why, with security issues flagged right where they appear
- Template versioning follows a git-like model: global templates as upstream, tenant forks as local branches, with merge capability
- Cost tracking per tenant is important for understanding builder usage patterns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-builder-and-automation*
*Context gathered: 2026-03-26*
