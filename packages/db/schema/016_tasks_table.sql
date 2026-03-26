-- 016: Tasks table
-- Core task entity for agent task execution and tracking.
-- Tasks belong to a business (tenant root), can be assigned to a department and agent,
-- and support parent/child hierarchy for subtask decomposition.

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  parent_task_id uuid REFERENCES public.tasks,
  department_id uuid REFERENCES public.departments,
  assigned_agent_id uuid REFERENCES public.agents,
  created_by uuid REFERENCES auth.users,
  title text NOT NULL,
  description text,
  payload jsonb DEFAULT '{}',
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'assigned', 'in_progress', 'waiting_approval', 'assistance_requested', 'completed', 'failed')),
  source text NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'api', 'webhook', 'orchestrator')),
  result jsonb,
  error_message text,
  token_usage jsonb DEFAULT '{"prompt_tokens": 0, "completion_tokens": 0}',
  cost_cents integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tasks_business ON public.tasks (business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (business_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON public.tasks (assigned_agent_id);

CREATE POLICY "tasks_select_member" ON public.tasks FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "tasks_insert_admin" ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

CREATE POLICY "tasks_update_admin" ON public.tasks FOR UPDATE
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

CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );
