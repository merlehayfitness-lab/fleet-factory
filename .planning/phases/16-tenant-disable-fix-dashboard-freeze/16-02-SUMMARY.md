---
phase: 16-tenant-disable-fix-dashboard-freeze
plan: 02
subsystem: actions, guards
tags: [mutation-guard, server-actions, tenant-disable]

# Dependency graph
requires:
  - phase: 16-tenant-disable-fix-dashboard-freeze
    plan: 01
    provides: "requireActiveBusiness guard function"
---

## What was built
Added `requireActiveBusiness()` guard to all mutation Server Actions across 11 action files. Every write operation now checks business status before proceeding. Disabled/suspended businesses cannot perform any mutations.

## Key decisions
- **Guard pattern**: `const guard = await requireActiveBusiness(businessId); if (guard) return guard;` — 2 lines per mutation, placed after auth check
- **Emergency exemptions**: `emergency-actions.ts` untouched — disable/restore/freeze operations must work regardless of business status
- **Read-only exemptions**: Getter/list/fetch actions have no guard — reads remain unblocked for frozen dashboard
- **Template actions skipped**: Templates are not business-scoped (no businessId), so no guard needed
- **VPS actions skipped**: Both functions are read-only health checks
- **Type narrowing**: Changed `result.error` to `"error" in result` in consumer components for union discrimination

## Files guarded (11 action files)
- `deployment-actions.ts` — deployAction, retryDeploymentAction, rollbackDeploymentAction, deployAgentAction
- `agent-actions.ts` — freezeAgent, pauseAgent, resumeAgent, retireAgent, updateAgentConfigAction, syncFromTemplateAction, reparentAgentAction
- `agent-wizard-actions.ts` — all wizard mutation functions
- `approval-actions.ts` — approveAction, rejectAction, bulkApproveAction, bulkRejectAction, provideGuidanceAction
- `chat-actions.ts` — sendMessageAction, archiveConversationAction
- `task-actions.ts` — createTaskAction, updateTaskStatusAction, quickAddTaskAction, deleteTaskAction
- `integration-actions.ts` — saveIntegrationAction, deleteIntegrationAction
- `knowledge-actions.ts` — upload/delete/triggerProcessing mutations
- `prompt-generator-actions.ts` — generate/refine mutations
- `secrets-actions.ts` — save/delete/saveProviderCredentials/deleteProviderSecrets
- `skill-actions.ts` — create/update/delete/assign/unassign mutations

## Consumer narrowing fixes (8 component files)
- `deploy-button.tsx`, `deployment-detail.tsx`, `rollback-dialog.tsx`
- `approval-card.tsx`, `approvals-list.tsx`
- `credential-side-drawer.tsx`, `task-detail-panel.tsx`, `task-quick-add.tsx`, `new-task-form.tsx`
- `agent-integrations.tsx`

## Pre-existing fixes included
- `chat-layout.tsx`: Fixed `sendSlackMessageAction` → `sendMessageAction` (missing export from Phase 14)
- `chat-layout.tsx`: Removed `slackChannels` prop from ChatChannelList, `channelName` from ChatMessageInput (props not in interfaces)

## Self-Check: PASSED
- [x] All 11 mutation action files have guard import and guard calls
- [x] Emergency actions NOT guarded
- [x] Read-only actions NOT guarded
- [x] `pnpm turbo typecheck` passes (5/5 tasks)
- [x] Consumer components use `"error" in result` for narrowing
