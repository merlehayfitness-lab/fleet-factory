-- 048: Expand departments type check for V2 department types
-- V2 adds marketing, rd (R&D), executive, and hr department types.

-- Drop the existing check constraint and add expanded one
ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_type_check;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_type_check
  CHECK (type IN ('owner', 'sales', 'support', 'operations', 'custom', 'marketing', 'rd', 'executive', 'hr'));
