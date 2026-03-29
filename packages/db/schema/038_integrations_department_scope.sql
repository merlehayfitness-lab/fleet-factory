-- 038: Add department-level integration support and catalog metadata

ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments ON DELETE CASCADE;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS setup_instructions text;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS name text;

CREATE INDEX IF NOT EXISTS idx_integrations_department ON public.integrations (department_id);

-- Replace old unique constraint with partial indexes
DROP INDEX IF EXISTS idx_integrations_business_agent_type;

-- Agent-level: one integration per type per agent per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_agent_unique
  ON public.integrations (business_id, agent_id, type) WHERE agent_id IS NOT NULL;

-- Department-level: one integration per type per department per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_department_unique
  ON public.integrations (business_id, department_id, type) WHERE department_id IS NOT NULL;
