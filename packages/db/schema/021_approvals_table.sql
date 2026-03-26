-- 021: Approvals table
-- Stores approval requests created when agents attempt risky actions.
-- Supports risk-tiered approval with two-step rejection flow.

CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents,
  action_type text NOT NULL,
  action_summary text NOT NULL,
  agent_reasoning text,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_explanation text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'auto_approved', 'approved', 'rejected', 'retry_pending', 'guidance_required')),
  decided_by uuid REFERENCES auth.users,
  decided_at timestamptz,
  decision_note text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_approvals_business ON public.approvals (business_id);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON public.approvals (task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals (business_id, status);

-- RLS policies: members can read, managers+ can insert/update
CREATE POLICY "approvals_select_member" ON public.approvals FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "approvals_insert_admin" ON public.approvals FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'));

CREATE POLICY "approvals_update_admin" ON public.approvals FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'));
