---
phase: 17-vps-activation-embedded-terminal
plan: 02
subsystem: infra, ui
tags: [xterm.js, ssh2, websocket, terminal, embedded-terminal, vps]

# Dependency graph
requires:
  - phase: 17-01
    provides: VPS API proxy server with WebSocket infrastructure and deployment pipeline
provides:
  - ssh2 WebSocket-to-SSH terminal bridge on VPS proxy
  - xterm.js embedded terminal client component with dynamic imports
  - Terminal page at /businesses/[id]/terminal with auth and VPS validation
  - Terminal info bar with VPS status, tenant name, container count, disconnect
  - Terminal icon link on health dashboard next to VPS status indicator
affects: [17-03-plan]

# Tech tracking
tech-stack:
  added: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-web-links"]
  patterns: [dynamic-css-import-with-ts-expect-error, websocket-binary-bridge, exponential-backoff-reconnect]

key-files:
  created:
    - infra/vps/terminal-bridge.ts
    - apps/web/_components/embedded-terminal.tsx
    - apps/web/_components/terminal-info-bar.tsx
    - apps/web/app/(dashboard)/businesses/[id]/terminal/page.tsx
  modified:
    - infra/vps/api-server.ts
    - infra/vps/setup.sh
    - apps/web/_components/health-dashboard.tsx
    - apps/web/package.json

key-decisions:
  - "Dynamic CSS import for xterm.css with @ts-expect-error suppression (bundler handles at runtime)"
  - "TerminalInfoBar uses businessId prop with useRouter for disconnect navigation instead of onDisconnect callback"
  - "VPS health fetch is best-effort in terminal page (try/catch with offline fallback)"

patterns-established:
  - "Dynamic xterm.js import pattern: import Terminal, FitAddon, WebLinksAddon, and CSS inside useEffect to avoid SSR"
  - "WebSocket binary bridge pattern: ws.binaryType = arraybuffer, JSON resize commands, raw terminal input"
  - "Exponential backoff reconnect: 1s, 2s, 4s, 8s max with colored terminal message"

requirements-completed: [VPS-TERM-01, VPS-TERM-02, VPS-TERM-03, VPS-TERM-04, VPS-TERM-05]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 17 Plan 02: Embedded Terminal Summary

**ssh2 WebSocket-to-SSH bridge with xterm.js browser terminal, info bar, and dashboard gear icon for VPS shell access**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T19:25:43Z
- **Completed:** 2026-03-30T19:29:43Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- SSH terminal bridge on VPS proxy: WebSocket data bridged to localhost SSH via ssh2 (pure JS, no node-pty)
- Full xterm.js embedded terminal with dark theme, resize support, and exponential backoff reconnection
- Terminal page at /businesses/[id]/terminal with auth check, VPS validation, and info bar
- Gear/Terminal icon on health dashboard next to VPS status indicator for quick terminal access

## Task Commits

Each task was committed atomically:

1. **Task 1: VPS terminal bridge and WebSocket wiring** - `ea53e3c` (feat)
2. **Task 2: xterm.js terminal page, info bar, gear icon on dashboard** - `237ebaa` (feat)

## Files Created/Modified
- `infra/vps/terminal-bridge.ts` - ssh2 WebSocket-to-SSH bridge, scoped to /data/tenants/{businessSlug}/
- `infra/vps/api-server.ts` - Wired handleTerminalWebSocket to call bridgeTerminal()
- `infra/vps/setup.sh` - Added terminal-bridge.ts to file copy section
- `apps/web/_components/embedded-terminal.tsx` - Client Component with dynamic xterm.js, WebSocket binary data, reconnect
- `apps/web/_components/terminal-info-bar.tsx` - Info bar showing VPS status, tenant name, container count, disconnect button
- `apps/web/app/(dashboard)/businesses/[id]/terminal/page.tsx` - Server Component terminal page with auth and VPS checks
- `apps/web/_components/health-dashboard.tsx` - Added Terminal icon link next to VpsStatusIndicator
- `apps/web/package.json` - Added @xterm/xterm, @xterm/addon-fit, @xterm/addon-web-links dependencies

## Decisions Made
- Dynamic CSS import for xterm.css uses @ts-expect-error since TypeScript cannot resolve CSS module types but the bundler handles it at runtime
- TerminalInfoBar uses businessId prop with useRouter().push() for disconnect navigation instead of an onDisconnect callback, avoiding the need for a client wrapper around the Server Component page
- VPS health fetch in terminal page is best-effort with try/catch (falls back to "offline" status)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @ts-expect-error for xterm CSS dynamic import**
- **Found during:** Task 2 (Typecheck verification)
- **Issue:** TypeScript cannot resolve `@xterm/xterm/css/xterm.css` module type, causing TS2307 error
- **Fix:** Added `// @ts-expect-error` comment before the dynamic CSS import line
- **Files modified:** apps/web/_components/embedded-terminal.tsx
- **Verification:** `pnpm turbo typecheck` passes
- **Committed in:** 237ebaa (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard CSS module type resolution issue. No scope creep.

## Issues Encountered
None beyond the CSS type resolution handled above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Terminal bridge and client ready for end-to-end testing in Plan 03
- VPS proxy needs SSH_USER/SSH_PASSWORD or SSH_PRIVATE_KEY_PATH env vars for real SSH connections
- Terminal page accessible via gear icon on health dashboard

## Self-Check: PASSED

All 7 created/modified files verified present. Both task commits (ea53e3c, 237ebaa) confirmed in git log.

---
*Phase: 17-vps-activation-embedded-terminal*
*Completed: 2026-03-30*
