-- 026: Phase 5 performance indexes
-- Additional indexes for health dashboard queries on existing tables.

CREATE INDEX IF NOT EXISTS idx_agents_business_status ON public.agents (business_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_business_completed ON public.tasks (business_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_business_failed ON public.tasks (business_id, status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_recent ON public.audit_logs (business_id, created_at DESC);
