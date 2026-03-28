-- Combined schema for Agency Factory
-- Paste this entire file into Supabase SQL Editor and run it.

-- 001: Businesses
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  industry text DEFAULT 'general',
  status text NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'suspended', 'disabled')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_businesses_updated_at ON public.businesses;
CREATE TRIGGER set_businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 002: Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 003: Business Users
CREATE TABLE IF NOT EXISTS public.business_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (business_id, user_id)
);
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_users_business_user ON public.business_users (business_id, user_id);

-- 004: Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('owner', 'sales', 'support', 'operations', 'custom')),
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_departments_business_type ON public.departments (business_id, type);
DROP TRIGGER IF EXISTS set_departments_updated_at ON public.departments;
CREATE TRIGGER set_departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 005: Agent Templates
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
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_agent_templates_department_type ON public.agent_templates (department_type);
DROP TRIGGER IF EXISTS set_agent_templates_updated_at ON public.agent_templates;
CREATE TRIGGER set_agent_templates_updated_at BEFORE UPDATE ON public.agent_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.agent_templates (name, department_type, description, system_prompt, tool_profile, model_profile)
VALUES
  ('Owner Agent', 'owner', 'Business owner oversight and strategy agent',
   'You are an owner agent for {{business_name}}. You help with business oversight, strategy, and high-level decision making.', '{}', '{}'),
  ('Sales Agent', 'sales', 'Lead generation, outreach, and deal management agent',
   'You are a sales agent for {{business_name}}. You help with lead generation, outreach, and deal management.', '{}', '{}'),
  ('Support Agent', 'support', 'Customer support and ticket resolution agent',
   'You are a support agent for {{business_name}}. You help with customer support and ticket resolution.', '{}', '{}'),
  ('Operations Agent', 'operations', 'Internal operations, scheduling, and process management agent',
   'You are an operations agent for {{business_name}}. You help with internal operations, scheduling, and process management.', '{}', '{}')
ON CONFLICT DO NOTHING;

-- 006: Agents
CREATE TABLE IF NOT EXISTS public.agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.agent_templates,
  name text NOT NULL,
  system_prompt text NOT NULL,
  tool_profile jsonb DEFAULT '{}',
  model_profile jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'paused', 'error', 'retired')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_agents_business_department ON public.agents (business_id, department_id);
DROP TRIGGER IF EXISTS set_agents_updated_at ON public.agents;
CREATE TRIGGER set_agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 007: Deployments
CREATE TABLE IF NOT EXISTS public.deployments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'building', 'deploying', 'verifying', 'live', 'failed', 'rolled_back')),
  config_snapshot jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_deployments_business_created ON public.deployments (business_id, created_at DESC);

-- 008: Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created ON public.audit_logs (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_action ON public.audit_logs (business_id, action);

-- 009: RLS Helpers
CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users bu
    JOIN public.businesses b ON b.id = bu.business_id
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.business_id = p_business_id
      AND b.status != 'disabled'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role_on_business(p_business_id uuid, p_role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users bu
    JOIN public.businesses b ON b.id = bu.business_id
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.business_id = p_business_id
      AND b.status != 'disabled'
      AND (p_role IS NULL OR bu.role = p_role)
  );
$$;

-- 010: RLS Policies
CREATE POLICY "businesses_select_member" ON public.businesses FOR SELECT TO authenticated
  USING (public.is_business_member(id));
CREATE POLICY "businesses_insert_authenticated" ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "businesses_update_owner" ON public.businesses FOR UPDATE TO authenticated
  USING (public.has_role_on_business(id, 'owner')) WITH CHECK (public.has_role_on_business(id, 'owner'));
CREATE POLICY "businesses_delete_owner" ON public.businesses FOR DELETE TO authenticated
  USING (public.has_role_on_business(id, 'owner'));

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "business_users_select_member" ON public.business_users FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY "business_users_insert_owner" ON public.business_users FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner'));
CREATE POLICY "business_users_update_owner" ON public.business_users FOR UPDATE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')) WITH CHECK (public.has_role_on_business(business_id, 'owner'));
CREATE POLICY "business_users_delete_owner" ON public.business_users FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner'));

CREATE POLICY "departments_select_member" ON public.departments FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY "departments_insert_owner_admin" ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "departments_update_owner_admin" ON public.departments FOR UPDATE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "departments_delete_owner_admin" ON public.departments FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "agent_templates_select_authenticated" ON public.agent_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "agents_select_member" ON public.agents FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY "agents_insert_owner_admin" ON public.agents FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "agents_update_owner_admin" ON public.agents FOR UPDATE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "agents_delete_owner_admin" ON public.agents FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "deployments_select_member" ON public.deployments FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY "deployments_insert_owner_admin" ON public.deployments FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "deployments_update_owner_admin" ON public.deployments FOR UPDATE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "audit_logs_select_member" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(business_id));

-- 010: Provision RPC
CREATE OR REPLACE FUNCTION public.provision_business_tenant(
  p_name text, p_slug text, p_industry text DEFAULT 'general'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_existing_id uuid;
  v_dept_types text[] := ARRAY['owner', 'sales', 'support', 'operations'];
  v_dept_type text;
  v_dept_id uuid;
  v_template RECORD;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT b.id INTO v_existing_id FROM public.businesses b
  JOIN public.business_users bu ON bu.business_id = b.id
  WHERE b.slug = p_slug AND bu.user_id = v_user_id AND bu.role = 'owner';
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;

  INSERT INTO public.businesses (name, slug, industry, status)
  VALUES (p_name, p_slug, p_industry, 'provisioning') RETURNING id INTO v_business_id;

  INSERT INTO public.business_users (business_id, user_id, role)
  VALUES (v_business_id, v_user_id, 'owner');

  FOREACH v_dept_type IN ARRAY v_dept_types LOOP
    INSERT INTO public.departments (business_id, name, type)
    VALUES (v_business_id, initcap(v_dept_type), v_dept_type) RETURNING id INTO v_dept_id;

    FOR v_template IN SELECT * FROM public.agent_templates
      WHERE department_type = v_dept_type AND is_active = true
    LOOP
      INSERT INTO public.agents (business_id, department_id, template_id, name, system_prompt, tool_profile, model_profile, status)
      VALUES (v_business_id, v_dept_id, v_template.id, v_template.name, v_template.system_prompt,
        v_template.tool_profile, v_template.model_profile, 'provisioning');
    END LOOP;
  END LOOP;

  INSERT INTO public.deployments (business_id, version, status) VALUES (v_business_id, 1, 'queued');
  UPDATE public.businesses SET status = 'active' WHERE id = v_business_id;
  RETURN v_business_id;
END; $$;

-- 011: Agent Frozen Status
ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_status_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_status_check
  CHECK (status IN ('provisioning', 'active', 'paused', 'frozen', 'error', 'retired'));

-- 012: Agent Templates RLS (Platform Admin)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users bu
    WHERE bu.user_id = (SELECT auth.uid())
      AND bu.role = 'owner'
  );
$$;

CREATE POLICY "agent_templates_insert_admin"
  ON public.agent_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "agent_templates_update_admin"
  ON public.agent_templates FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "agent_templates_delete_admin"
  ON public.agent_templates FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());

-- 013: Secrets table for encrypted credential storage
CREATE TABLE IF NOT EXISTS public.secrets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  key text NOT NULL,
  encrypted_value text NOT NULL,
  category text NOT NULL DEFAULT 'api_key'
    CHECK (category IN ('api_key', 'credential', 'token')),
  integration_type text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_secrets_business_key
  ON public.secrets (business_id, key);

DROP TRIGGER IF EXISTS set_secrets_updated_at ON public.secrets;
CREATE TRIGGER set_secrets_updated_at BEFORE UPDATE ON public.secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "secrets_select_member"
  ON public.secrets FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "secrets_insert_admin"
  ON public.secrets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "secrets_update_admin"
  ON public.secrets FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "secrets_delete_admin"
  ON public.secrets FOR DELETE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

-- 014: Integrations table for per-agent integration config
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock',
  type text NOT NULL
    CHECK (type IN ('crm', 'email', 'helpdesk', 'calendar', 'messaging')),
  config jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'mock'
    CHECK (status IN ('active', 'inactive', 'mock')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_integrations_business
  ON public.integrations (business_id);

CREATE INDEX IF NOT EXISTS idx_integrations_agent
  ON public.integrations (agent_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_business_agent_type
  ON public.integrations (business_id, agent_id, type);

DROP TRIGGER IF EXISTS set_integrations_updated_at ON public.integrations;
CREATE TRIGGER set_integrations_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "integrations_select_member"
  ON public.integrations FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "integrations_insert_admin"
  ON public.integrations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "integrations_update_admin"
  ON public.integrations FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

CREATE POLICY "integrations_delete_admin"
  ON public.integrations FOR DELETE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner') OR public.has_role_on_business(business_id, 'admin'));

-- 015: Add triggered_by and rolled_back_to columns to deployments
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS triggered_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS rolled_back_to integer;

-- 016: Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  parent_task_id uuid REFERENCES public.tasks,
  department_id uuid REFERENCES public.departments,
  assigned_agent_id uuid REFERENCES public.agents,
  created_by uuid REFERENCES auth.users,
  title text NOT NULL,
  description text,
  payload jsonb DEFAULT '{}',
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'assigned', 'in_progress', 'waiting_approval', 'assistance_requested', 'completed', 'failed')),
  source text NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'api', 'webhook', 'orchestrator')),
  result jsonb,
  error_message text,
  token_usage jsonb DEFAULT '{"prompt_tokens": 0, "completion_tokens": 0}',
  cost_cents integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tasks_business ON public.tasks (business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (business_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON public.tasks (assigned_agent_id);

CREATE POLICY "tasks_select_member" ON public.tasks FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "tasks_insert_admin" ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

CREATE POLICY "tasks_update_admin" ON public.tasks FOR UPDATE
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

CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- 017: Subtask Dependencies
CREATE TABLE IF NOT EXISTS public.subtask_dependencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  UNIQUE (task_id, depends_on_task_id)
);

ALTER TABLE public.subtask_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subtask_deps_select" ON public.subtask_dependencies FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_business_member(t.business_id)
  ));

CREATE POLICY "subtask_deps_insert" ON public.subtask_dependencies FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (
      public.has_role_on_business(t.business_id, 'owner')
      OR public.has_role_on_business(t.business_id, 'admin')
      OR public.has_role_on_business(t.business_id, 'manager')
    )
  ));

CREATE POLICY "subtask_deps_delete" ON public.subtask_dependencies FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (
      public.has_role_on_business(t.business_id, 'owner')
      OR public.has_role_on_business(t.business_id, 'admin')
    )
  ));

-- 018: Assistance Requests
CREATE TABLE IF NOT EXISTS public.assistance_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents,
  context text NOT NULL,
  blocking_reason text NOT NULL,
  admin_response text,
  responded_by uuid REFERENCES auth.users,
  responded_at timestamptz,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'responded', 'resolved')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assistance_business ON public.assistance_requests (business_id);
CREATE INDEX IF NOT EXISTS idx_assistance_task ON public.assistance_requests (task_id);
CREATE INDEX IF NOT EXISTS idx_assistance_status ON public.assistance_requests (business_id, status);

CREATE POLICY "assistance_select_member" ON public.assistance_requests FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "assistance_insert_admin" ON public.assistance_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

CREATE POLICY "assistance_update_admin" ON public.assistance_requests FOR UPDATE
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

-- 019: Usage Records
-- Tracks token usage and cost per agent task execution for metering.
CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks,
  agent_id uuid NOT NULL REFERENCES public.agents,
  model text NOT NULL DEFAULT 'claude-sonnet',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usage_business ON public.usage_records (business_id);
CREATE INDEX IF NOT EXISTS idx_usage_agent ON public.usage_records (agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_task ON public.usage_records (task_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON public.usage_records (business_id, created_at);

CREATE POLICY "usage_select_member" ON public.usage_records FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "usage_insert_admin" ON public.usage_records FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

-- 020: Add is_trusted column to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false;

-- 021: Approvals table
-- Stores approval requests created when agents attempt risky actions.
CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents,
  action_type text NOT NULL,
  action_summary text NOT NULL,
  agent_reasoning text,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_explanation text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'auto_approved', 'approved', 'rejected', 'retry_pending', 'guidance_required')),
  decided_by uuid REFERENCES auth.users,
  decided_at timestamptz,
  decision_note text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_approvals_business ON public.approvals (business_id);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON public.approvals (task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals (business_id, status);

CREATE POLICY "approvals_select_member" ON public.approvals FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "approvals_insert_admin" ON public.approvals FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'));

CREATE POLICY "approvals_update_admin" ON public.approvals FOR UPDATE
  TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager'));

-- 022: Approval Policies table
-- Global approval policy rules with seed data.
CREATE TABLE IF NOT EXISTS public.approval_policies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_pattern text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  description text,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('data_read', 'data_write', 'external_comm', 'config_change', 'destructive', 'financial', 'general')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies_select_all" ON public.approval_policies FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.approval_policies (action_pattern, risk_level, description, category) VALUES
  ('search_%', 'low', 'Search and lookup operations', 'data_read'),
  ('review_%', 'low', 'Review and read operations', 'data_read'),
  ('check_%', 'low', 'Status checks and diagnostics', 'data_read'),
  ('draft_%', 'medium', 'Draft creation (not sent)', 'data_write'),
  ('create_%', 'medium', 'Record creation', 'data_write'),
  ('generate_%', 'medium', 'Report and content generation', 'data_write'),
  ('run_%', 'medium', 'Run diagnostics or processes', 'data_write'),
  ('send_%', 'high', 'Send external communications', 'external_comm'),
  ('respond_%', 'high', 'Respond to external parties', 'external_comm'),
  ('update_%', 'high', 'Update existing records or configs', 'config_change'),
  ('close_%', 'high', 'Close or resolve records', 'destructive'),
  ('delete_%', 'high', 'Delete records', 'destructive'),
  ('schedule_%', 'high', 'Schedule operations or maintenance', 'config_change')
ON CONFLICT DO NOTHING;

-- 023: Phase 4 RLS policies placeholder
-- All Phase 4 RLS policies are defined in their respective migration files (016-022).
-- No additional supplemental RLS policies needed.

-- ====== 024: Conversations Table ======
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

CREATE POLICY "conversations_select_member" ON public.conversations FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "conversations_insert_admin" ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

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

-- ====== 025: Messages Table ======
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

CREATE POLICY "messages_select_member" ON public.messages FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "messages_insert_admin" ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
    OR public.has_role_on_business(business_id, 'manager')
  );

-- ====== 026: Phase 5 Performance Indexes ======
CREATE INDEX IF NOT EXISTS idx_agents_business_status ON public.agents (business_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_business_completed ON public.tasks (business_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_business_failed ON public.tasks (business_id, status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_recent ON public.audit_logs (business_id, created_at DESC);

-- ====== 027: VPS Status Table ======
CREATE TABLE IF NOT EXISTS public.vps_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('online', 'offline', 'degraded', 'unknown')),
  last_checked_at timestamptz DEFAULT now(),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.vps_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vps_status_select" ON public.vps_status FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "vps_status_update" ON public.vps_status FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "vps_status_insert" ON public.vps_status FOR INSERT
  TO authenticated WITH CHECK (true);

INSERT INTO public.vps_status (status, details)
VALUES ('unknown', '{"message": "VPS status not yet checked"}')
ON CONFLICT DO NOTHING;

-- ====== 028: Agent VPS Status Table ======
CREATE TABLE IF NOT EXISTS public.agent_vps_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  vps_agent_id text NOT NULL,
  container_status text DEFAULT 'unknown'
    CHECK (container_status IN ('running', 'stopped', 'error', 'unknown')),
  last_health_check_at timestamptz,
  last_response_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.agent_vps_status ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_vps_status_business ON public.agent_vps_status (business_id);
CREATE INDEX IF NOT EXISTS idx_agent_vps_status_agent ON public.agent_vps_status (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_vps_status_unique ON public.agent_vps_status (agent_id);

CREATE POLICY "agent_vps_status_select" ON public.agent_vps_status FOR SELECT
  TO authenticated USING (public.is_business_member(business_id));

CREATE POLICY "agent_vps_status_insert" ON public.agent_vps_status FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "agent_vps_status_update" ON public.agent_vps_status FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- ====== 029: Deployments VPS Columns ======
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS optimization_report jsonb,
  ADD COLUMN IF NOT EXISTS deploy_target text DEFAULT 'local'
    CHECK (deploy_target IN ('local', 'vps')),
  ADD COLUMN IF NOT EXISTS vps_deploy_id text;

-- ====== 030: pgvector Extension ======
CREATE EXTENSION IF NOT EXISTS vector;

-- ====== 031: Knowledge Tables ======

-- knowledge_documents: stores document metadata
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  title text NOT NULL,
  filename text,
  file_type text NOT NULL DEFAULT 'text'
    CHECK (file_type IN ('text', 'markdown', 'pdf', 'docx', 'xlsx')),
  file_size_bytes integer,
  storage_path text,
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  error_message text,
  chunk_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_business
  ON public.knowledge_documents (business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent
  ON public.knowledge_documents (business_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status
  ON public.knowledge_documents (business_id, status);

-- RLS: members read, owner/admin write
CREATE POLICY "knowledge_docs_select_member" ON public.knowledge_documents
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_docs_insert_admin" ON public.knowledge_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_docs_update_admin" ON public.knowledge_documents
  FOR UPDATE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'))
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_docs_delete_admin" ON public.knowledge_documents
  FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));

-- knowledge_chunks: stores text chunks with embeddings
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.knowledge_documents ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  token_count integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_business
  ON public.knowledge_chunks (business_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent
  ON public.knowledge_chunks (business_id, agent_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- RLS: members read, owner/admin write
CREATE POLICY "knowledge_chunks_select_member" ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_chunks_insert_admin" ON public.knowledge_chunks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));
CREATE POLICY "knowledge_chunks_delete_admin" ON public.knowledge_chunks
  FOR DELETE TO authenticated
  USING (public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin'));

-- knowledge_retrievals: logs retrieval events for observability
CREATE TABLE IF NOT EXISTS public.knowledge_retrievals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents,
  conversation_id uuid REFERENCES public.conversations,
  task_id uuid REFERENCES public.tasks,
  query_text text NOT NULL,
  chunks_retrieved jsonb NOT NULL DEFAULT '[]',
  retrieval_time_ms integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.knowledge_retrievals ENABLE ROW LEVEL SECURITY;

-- RLS: members read, members insert (agents need to log retrievals)
CREATE POLICY "knowledge_retrievals_select_member" ON public.knowledge_retrievals
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "knowledge_retrievals_insert_member" ON public.knowledge_retrievals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_business_member(business_id));

-- ====== 032: Knowledge Retrieval RPC ======
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_business_id uuid,
  p_agent_id uuid DEFAULT NULL,
  p_query_embedding vector(1536) DEFAULT NULL,
  p_match_threshold float DEFAULT 0.7,
  p_match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  agent_id uuid,
  similarity float
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    kc.chunk_index,
    kc.agent_id,
    1 - (kc.embedding <=> p_query_embedding)::float AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.business_id = p_business_id
    AND (
      kc.agent_id IS NULL
      OR kc.agent_id = p_agent_id
    )
    AND 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- ====== 033: Agent Role & Hierarchy ======
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skill_definition text,
  ADD COLUMN IF NOT EXISTS role_definition jsonb;

CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id
  ON public.agents (parent_agent_id);
