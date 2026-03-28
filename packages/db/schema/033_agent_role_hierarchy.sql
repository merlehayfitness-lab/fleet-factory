-- ====== 033: Agent Role & Hierarchy ======
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_definition text,
  ADD COLUMN IF NOT EXISTS role_definition jsonb;

CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id
  ON public.agents (parent_agent_id);
