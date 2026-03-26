-- 019: Usage Records
-- Tracks token usage and cost per agent task execution for metering.
CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks,
  agent_id uuid NOT NULL REFERENCES public.agents,
  model text NOT NULL DEFAULT 'claude-sonnet',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usage_business ON public.usage_records (business_id);
CREATE INDEX IF NOT EXISTS idx_usage_agent ON public.usage_records (agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_task ON public.usage_records (task_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON public.usage_records (business_id, created_at);

-- Members can view usage data; insert is system-only via Server Actions (managers+ can trigger tasks)
CREATE POLICY "usage_select_member" ON public.usage_records FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "usage_insert_admin" ON public.usage_records FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );
