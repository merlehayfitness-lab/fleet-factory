-- 024: Conversations table
-- Stores chat conversations scoped to a business + department.

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users,
  title text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_conversations_business ON public.conversations (business_id);
CREATE INDEX IF NOT EXISTS idx_conversations_department ON public.conversations (business_id, department_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations (business_id, user_id);

-- RLS: any business member can read conversations
CREATE POLICY "conversations_select_member" ON public.conversations FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

-- RLS: owner/admin/manager can create conversations
CREATE POLICY "conversations_insert_admin" ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

-- RLS: owner/admin/manager can update conversations (archive, update counts)
CREATE POLICY "conversations_update_admin" ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );
