-- 025: Messages table
-- Stores individual messages within conversations. Messages are immutable (no UPDATE/DELETE).

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  agent_id uuid REFERENCES public.agents,
  content text NOT NULL,
  tool_calls jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_business ON public.messages (business_id);

-- RLS: any business member can read messages
CREATE POLICY "messages_select_member" ON public.messages FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

-- RLS: owner/admin/manager can insert messages (messages are immutable, no UPDATE/DELETE)
CREATE POLICY "messages_insert_admin" ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );
