-- ====== 034: Department Skill ======
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS department_skill text;
