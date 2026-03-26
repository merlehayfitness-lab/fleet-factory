-- 018: Assistance Requests
-- When an agent is blocked during task execution, it creates an assistance request.
-- Admins can respond to unblock the agent and resume task execution.

CREATE TABLE IF NOT EXISTS public.assistance_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents,
  context text NOT NULL,
  blocking_reason text NOT NULL,
  admin_response text,
  responded_by uuid REFERENCES auth.users,
  responded_at timestamptz,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'responded', 'resolved')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assistance_business ON public.assistance_requests (business_id);
CREATE INDEX IF NOT EXISTS idx_assistance_task ON public.assistance_requests (task_id);
CREATE INDEX IF NOT EXISTS idx_assistance_status ON public.assistance_requests (business_id, status);

CREATE POLICY "assistance_select_member" ON public.assistance_requests FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "assistance_insert_admin" ON public.assistance_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

CREATE POLICY "assistance_update_admin" ON public.assistance_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );
