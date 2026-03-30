-- 041: Slack integration tables
-- Stores per-business Slack workspace installations and channel-to-department mappings.
-- Also adds Slack metadata columns to messages and conversations tables.

-- 1. slack_installations: one Slack workspace per business
CREATE TABLE IF NOT EXISTS public.slack_installations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  slack_team_id text NOT NULL,
  slack_team_name text,
  bot_user_id text NOT NULL,
  installed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id),
  UNIQUE(slack_team_id)
);

ALTER TABLE public.slack_installations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id
  ON public.slack_installations (slack_team_id);

-- RLS: business members can view their installation
CREATE POLICY "slack_installations_select_member"
  ON public.slack_installations FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- RLS: owner/admin can create installation
CREATE POLICY "slack_installations_insert_admin"
  ON public.slack_installations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- RLS: owner/admin can update installation
CREATE POLICY "slack_installations_update_admin"
  ON public.slack_installations FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- 2. slack_channel_mappings: maps Slack channels to departments/agents
CREATE TABLE IF NOT EXISTS public.slack_channel_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  slack_channel_id text NOT NULL,
  slack_channel_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.slack_channel_mappings ENABLE ROW LEVEL SECURITY;

-- One channel per business (no duplicate channel mappings)
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_channel_mappings_business_channel
  ON public.slack_channel_mappings (business_id, slack_channel_id);

-- One main channel per department (where agent_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_channel_mappings_business_dept
  ON public.slack_channel_mappings (business_id, department_id) WHERE agent_id IS NULL;

-- RLS: business members can view channel mappings
CREATE POLICY "slack_channel_mappings_select_member"
  ON public.slack_channel_mappings FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- RLS: owner/admin can create mappings
CREATE POLICY "slack_channel_mappings_insert_admin"
  ON public.slack_channel_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- RLS: owner/admin can update mappings
CREATE POLICY "slack_channel_mappings_update_admin"
  ON public.slack_channel_mappings FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- RLS: owner/admin can delete mappings
CREATE POLICY "slack_channel_mappings_delete_admin"
  ON public.slack_channel_mappings FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- 3. ALTER messages table: add Slack metadata columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS slack_ts text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS slack_channel_id text;

CREATE INDEX IF NOT EXISTS idx_messages_slack_ts
  ON public.messages (slack_ts) WHERE slack_ts IS NOT NULL;

-- 4. ALTER conversations table: link conversation to Slack channel
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS slack_channel_id text;
