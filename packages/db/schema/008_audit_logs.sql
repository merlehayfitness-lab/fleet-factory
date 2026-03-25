-- 008_audit_logs.sql
-- Audit trail for important actions within a business.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Index for log lookups by business, ordered by creation
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created
  ON public.audit_logs (business_id, created_at DESC);

-- Index for filtering logs by action within a business
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_action
  ON public.audit_logs (business_id, action);
