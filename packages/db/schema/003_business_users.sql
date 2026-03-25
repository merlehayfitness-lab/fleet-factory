-- 003_business_users.sql
-- Links users to businesses with role-based access.

CREATE TABLE IF NOT EXISTS public.business_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (business_id, user_id)
);

-- Enable RLS immediately
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

-- Composite index for membership lookups
CREATE INDEX IF NOT EXISTS idx_business_users_business_user
  ON public.business_users (business_id, user_id);
