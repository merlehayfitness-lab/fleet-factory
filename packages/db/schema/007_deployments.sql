-- 007_deployments.sql
-- Deployment records for each business tenant.

CREATE TABLE IF NOT EXISTS public.deployments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'building', 'deploying', 'verifying', 'live', 'failed', 'rolled_back')),
  config_snapshot jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

-- Index for deployment lookups by business, ordered by creation
CREATE INDEX IF NOT EXISTS idx_deployments_business_created
  ON public.deployments (business_id, created_at DESC);
