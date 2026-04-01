-- 050: CRM tables for Twenty CRM integration
-- Stores local copies of contacts, deals, and activities synced from Twenty CRM.

-- 1. crm_contacts
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  external_id text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  job_title text,
  source text NOT NULL DEFAULT 'inbound'
    CHECK (source IN ('inbound', 'outbound', 'referral', 'organic')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  score integer,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_business ON public.crm_contacts (business_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_external ON public.crm_contacts (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON public.crm_contacts (business_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON public.crm_contacts (business_id, email);

CREATE POLICY "crm_contacts_select_member"
  ON public.crm_contacts FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "crm_contacts_insert_member"
  ON public.crm_contacts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "crm_contacts_update_member"
  ON public.crm_contacts FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

DROP TRIGGER IF EXISTS set_crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER set_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. crm_deals
CREATE TABLE IF NOT EXISTS public.crm_deals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts ON DELETE SET NULL,
  external_id text,
  title text NOT NULL,
  value numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stage text NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability integer NOT NULL DEFAULT 10,
  expected_close_date date,
  assigned_agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_deals_business ON public.crm_deals (business_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON public.crm_deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON public.crm_deals (business_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_deals_external ON public.crm_deals (external_id) WHERE external_id IS NOT NULL;

CREATE POLICY "crm_deals_select_member"
  ON public.crm_deals FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "crm_deals_insert_member"
  ON public.crm_deals FOR INSERT
  TO authenticated
  WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "crm_deals_update_member"
  ON public.crm_deals FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (public.is_business_member(business_id));

DROP TRIGGER IF EXISTS set_crm_deals_updated_at ON public.crm_deals;
CREATE TRIGGER set_crm_deals_updated_at
  BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. crm_activities
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts ON DELETE SET NULL,
  deal_id uuid REFERENCES public.crm_deals ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'note'
    CHECK (type IN ('email_sent', 'email_received', 'call', 'meeting', 'note', 'task', 'deal_update')),
  subject text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_activities_business ON public.crm_activities (business_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON public.crm_activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON public.crm_activities (deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created ON public.crm_activities (business_id, created_at);

CREATE POLICY "crm_activities_select_member"
  ON public.crm_activities FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "crm_activities_insert_member"
  ON public.crm_activities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_business_member(business_id));
