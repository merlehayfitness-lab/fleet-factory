-- 015: Add triggered_by and rolled_back_to columns to deployments
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS triggered_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS rolled_back_to integer;
