-- 006_agents.sql
-- Agents instantiated from templates, scoped to a business and department.

CREATE TABLE IF NOT EXISTS public.agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.agent_templates,
  name text NOT NULL,
  system_prompt text NOT NULL,
  tool_profile jsonb DEFAULT '{}',
  model_profile jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'paused', 'error', 'retired')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Composite index for agent lookups by business and department
CREATE INDEX IF NOT EXISTS idx_agents_business_department
  ON public.agents (business_id, department_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_agents_updated_at ON public.agents;
CREATE TRIGGER set_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
