-- 017: Subtask Dependencies
-- DAG edges for subtask ordering. Each row says "task_id depends on depends_on_task_id".
-- Used by the orchestrator to determine execution order for decomposed tasks.

CREATE TABLE IF NOT EXISTS public.subtask_dependencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  UNIQUE (task_id, depends_on_task_id)
);

ALTER TABLE public.subtask_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS: inherit access from the parent task's business_id
CREATE POLICY "subtask_deps_select" ON public.subtask_dependencies FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_business_member(t.business_id)
  ));

CREATE POLICY "subtask_deps_insert" ON public.subtask_dependencies FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (
      public.has_role_on_business(t.business_id, 'owner')
      OR public.has_role_on_business(t.business_id, 'admin')
      OR public.has_role_on_business(t.business_id, 'manager')
    )
  ));

CREATE POLICY "subtask_deps_delete" ON public.subtask_dependencies FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (
      public.has_role_on_business(t.business_id, 'owner')
      OR public.has_role_on_business(t.business_id, 'admin')
    )
  ));
