-- 045: API usage tracking and call queue for rate limiting
-- api_usage: detailed per-call usage logging (extends usage_records with rate-limit context)
-- api_call_queue: Supabase-backed overflow queue for rate limiting

-- 1. api_usage: tracks every API call with timing and cost
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  model text NOT NULL,
  provider text NOT NULL DEFAULT 'anthropic',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost_cents numeric(10,4) NOT NULL DEFAULT 0,
  latency_ms integer,
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'failed', 'rate_limited', 'queued')),
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_usage_business ON public.api_usage (business_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_agent ON public.api_usage (agent_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON public.api_usage (created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_business_date ON public.api_usage (business_id, created_at);

-- RLS: business members can view usage
CREATE POLICY "api_usage_select_member"
  ON public.api_usage FOR SELECT
  TO authenticated
  USING (
    business_id IS NULL  -- system-level usage visible to all authenticated
    OR public.is_business_member(business_id)
  );

-- 2. api_call_queue: overflow queue for rate-limited calls
CREATE TABLE IF NOT EXISTS public.api_call_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE public.api_call_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_call_queue_status ON public.api_call_queue (status);
CREATE INDEX IF NOT EXISTS idx_api_call_queue_priority ON public.api_call_queue (status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_api_call_queue_business ON public.api_call_queue (business_id);

-- RLS: business members can view their queue
CREATE POLICY "api_call_queue_select_member"
  ON public.api_call_queue FOR SELECT
  TO authenticated
  USING (
    business_id IS NULL
    OR public.is_business_member(business_id)
  );

-- Helper: get current concurrent call count
CREATE OR REPLACE FUNCTION public.get_active_api_calls()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.api_call_queue
  WHERE status = 'processing';
$$;
