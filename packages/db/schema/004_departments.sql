-- 004_departments.sql
-- Departments within a business tenant.

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('owner', 'sales', 'support', 'operations', 'custom')),
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS immediately
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Composite index for department lookups by business and type
CREATE INDEX IF NOT EXISTS idx_departments_business_type
  ON public.departments (business_id, type);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_departments_updated_at ON public.departments;
CREATE TRIGGER set_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
