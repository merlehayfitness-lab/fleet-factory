# Phase 17: VPS Activation & Embedded Terminal - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the first real agent to the Hostinger VPS, replace all stubbed VPS API endpoints with real implementations, and provide an embedded browser-based terminal for direct VPS access from the admin panel. Includes end-to-end verification that the full loop (deploy, chat, task, approval) works with real agents on real infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Terminal Access Model
- Full SSH shell, restricted to platform-level admins only (not business owners)
- Terminal sessions scoped to the business tenant's directory on VPS (`/data/tenants/{businessSlug}/`) — since VPS is tenant-dependent
- Connection goes through the existing VPS API proxy (new WebSocket endpoint on Express server port 3100), reusing API key auth — no SSH keys needed in browser
- Terminal session persists while navigating within business pages — only dies when leaving the business or closing the tab

### VPS Activation Scope
- **All 6 stubbed areas replaced** with real implementations:
  1. Claude Code optimization (Step 3 in deploy)
  2. Docker container management (Step 4 in deploy)
  3. Chat routing to OpenClaw agents
  4. Task execution routing to agents
  5. WebSocket deployment progress streaming
  6. WebSocket chat token streaming
- `/api/tenants/stop` and `/api/tenants/resume` endpoints also implemented (needed by Phase 16 lifecycle)
- VPS initial setup is a **manual checklist** (run setup.sh, configure OpenClaw, bootstrap Claude Code) — automation deferred to a future phase
- Deployment state persisted to **JSON files on VPS** (survives proxy restarts), not just in-memory
- **One container per agent** as designed in Phase 6 bootstrap-prompt.md (openclaw-sandbox-common image, 512MB, 0.5 CPUs)
- Chat/task routing goes through **OpenClaw gateway** (ws://127.0.0.1:18789), not direct container routing
- **Real WebSocket streaming** for both deploy progress events and chat tokens (scaffolding already exists in api-server.ts)
- If Claude Code optimization fails, **deployment fails** — don't deploy un-optimized configs

### Terminal Page & Navigation
- **Standalone page** at `/businesses/[id]/terminal` — terminal fills the viewport
- Accessed via **gear icon on VPS status badge** on the health dashboard (no sidebar nav entry)
- Page shows terminal + **info bar** at top with VPS status, connected tenant, agent container count, and disconnect button
- **Dark terminal theme** — classic dark background with green/white text, regardless of app theme

### End-to-End Verification
- "First real agent running" means the **full loop**: deploy → chat → task → approval, all hitting real VPS agents
- Agents use **real Claude API responses** (Anthropic API with system prompts) — requires API key configured on VPS
- Verification is **manual testing** through the admin panel — automated smoke test deferred to later
- Plan includes a **suggested test scenario** as guidance (not a strict requirement)
- When agent fails to respond: **both agent-level error badge AND deployment marked as degraded** — full visibility at both levels
- **Approval flow routes back to Supabase** — agent pauses, sends approval request to Supabase via API, admin approves in admin panel, decision flows back to VPS
- VPS health check **auto-polls every 30s** (matches existing dashboard polling pattern)
- Agent **memory persists across redeployments** — memory/ directory and MEMORY.md never overwritten (confirms Phase 6 bootstrap spec)

### Claude's Discretion
- xterm.js addon selection and terminal configuration
- WebSocket reconnection strategy for terminal sessions
- Exact layout and styling of terminal info bar
- File-based persistence format for VPS deployment state
- VPS API route implementation details for container management

</decisions>

<specifics>
## Specific Ideas

- Terminal page should feel like a real terminal — dark theme matches the user's preference for dark terminal-style UI
- Gear icon on VPS badge is the sole entry point — keeps navigation clean, terminal is a power-user feature
- The existing VPS infrastructure (Express server, WebSocket support, api-routes.ts) is extensive and should be built on, not replaced
- bootstrap-prompt.md and setup.sh already exist and are production-ready — this phase activates them, not rewrites them
- Suggested test scenario for manual verification: "Create a business, deploy to VPS, chat with Sales Agent, send a lead qualification task, see approval request in admin panel, approve it, verify result flows back"

</specifics>

<deferred>
## Deferred Ideas

- Automated VPS provisioning script (one-click setup) — future phase
- Automated smoke test / health check script — future phase
- Terminal access for business owners (currently platform admin only) — future phase, needs RBAC
- Sidebar nav entry for Terminal — reconsider if terminal becomes a frequently-used feature
- Bottom drawer terminal (VS Code style) — alternative to standalone page, reconsider in v2

</deferred>

---

*Phase: 17-vps-activation-embedded-terminal*
*Context gathered: 2026-03-30*
