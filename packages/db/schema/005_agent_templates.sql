-- 005_agent_templates.sql
-- Global agent templates. Readable by all authenticated users, writable only via service_role.

CREATE TABLE IF NOT EXISTS public.agent_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department_type text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  tool_profile jsonb DEFAULT '{}',
  model_profile jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;

-- Index for template lookup by department type
CREATE INDEX IF NOT EXISTS idx_agent_templates_department_type
  ON public.agent_templates (department_type);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_agent_templates_updated_at ON public.agent_templates;
CREATE TRIGGER set_agent_templates_updated_at
  BEFORE UPDATE ON public.agent_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed starter templates (one per department type)
INSERT INTO public.agent_templates (name, department_type, description, system_prompt, tool_profile, model_profile)
VALUES
  (
    'Owner Agent',
    'owner',
    'Business owner oversight and strategy agent',
    'You are an owner agent for {{business_name}}. You help with business oversight, strategy, and high-level decision making.',
    '{}',
    '{}'
  ),
  (
    'Sales Agent',
    'sales',
    'Lead generation, outreach, and deal management agent',
    'You are a sales agent for {{business_name}}. You help with lead generation, outreach, and deal management.',
    '{}',
    '{}'
  ),
  (
    'Support Agent',
    'support',
    'Customer support and ticket resolution agent',
    'You are a support agent for {{business_name}}. You help with customer support and ticket resolution.',
    '{}',
    '{}'
  ),
  (
    'Operations Agent',
    'operations',
    'Internal operations, scheduling, and process management agent',
    'You are an operations agent for {{business_name}}. You help with internal operations, scheduling, and process management.',
    '{}',
    '{}'
  )
ON CONFLICT DO NOTHING;
