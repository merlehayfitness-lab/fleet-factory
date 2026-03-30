---
phase: 17-vps-activation-embedded-terminal
plan: 03
subsystem: infra
tags: [vps, health-check, polling, setup-guide, docker, openclaw, terminal]

# Dependency graph
requires:
  - phase: 17-01
    provides: VPS deploy pipeline, proxy API, container manager, health endpoint
  - phase: 17-02
    provides: Embedded terminal bridge, terminal UI page, xterm.js integration
provides:
  - 30-second auto-poll interval on VPS status indicator
  - Comprehensive VPS setup checklist with 8-step activation guide
  - End-to-end verification scenario covering deploy, chat, task, approval, terminal, health
  - Troubleshooting guide for common VPS issues
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "30s setInterval auto-poll for VPS health (matches health-dashboard.tsx pattern)"

key-files:
  created:
    - infra/vps/SETUP-CHECKLIST.md
  modified:
    - apps/web/_components/vps-status-indicator.tsx

key-decisions:
  - "No changes needed to health-dashboard.tsx -- existing 30s poll already covers VPS status via SystemHealth"
  - "No changes needed to vps-actions.ts -- checkVpsHealthAction already works with 30s polling"

patterns-established:
  - "Auto-poll pattern: mount-refresh + 30s setInterval with cleanup on unmount"

requirements-completed: [VPS-TERM-01, VPS-TERM-02, VPS-TERM-03, VPS-TERM-04, VPS-TERM-05]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 17 Plan 03: End-to-End Verification Wiring Summary

**VPS health auto-polls at 30s intervals with comprehensive setup checklist covering 8 activation steps and 7-step E2E verification scenario**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T19:32:45Z
- **Completed:** 2026-03-30T19:35:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- VPS status indicator auto-polls every 30 seconds matching the dashboard health polling pattern
- Comprehensive SETUP-CHECKLIST.md with 8 sequential activation steps from bare VPS to running agents
- End-to-end verification scenario covering all 5 requirements: deploy, gear icon, terminal, containers, full loop
- Troubleshooting guide covering 5 common failure modes with diagnostic commands

## Task Commits

Each task was committed atomically:

1. **Task 1: VPS health auto-poll at 30s and agent error indicators** - `f195fdf` (feat)
2. **Task 2: Manual VPS setup checklist with E2E verification scenario** - `9bcd2c9` (docs)

## Files Created/Modified

- `apps/web/_components/vps-status-indicator.tsx` - Added 30s setInterval auto-poll for VPS health status
- `infra/vps/SETUP-CHECKLIST.md` - New comprehensive VPS activation and verification guide

## Decisions Made

- No changes needed to health-dashboard.tsx -- existing 30s poll via getHealthDashboard already covers VPS status through SystemHealth data
- No changes needed to vps-actions.ts -- checkVpsHealthAction already returns the correct shape for polling
- Agent error states already propagated through existing health service pipeline (agents table status field updated by deploy pipeline)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The SETUP-CHECKLIST.md created in this plan documents future VPS activation steps but does not require immediate action.

## Next Phase Readiness

Phase 17 is complete. All 3 plans have been executed:
- Plan 01: VPS deploy pipeline, proxy API, container manager, health endpoint
- Plan 02: Embedded terminal bridge with xterm.js UI
- Plan 03: Auto-poll health monitoring and comprehensive setup checklist

The VPS activation infrastructure is ready for manual activation following the SETUP-CHECKLIST.md when a VPS is provisioned.

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 17-vps-activation-embedded-terminal*
*Completed: 2026-03-30*
