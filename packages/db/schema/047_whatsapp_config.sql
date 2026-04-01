-- 047: WhatsApp configuration table
-- Per-business WhatsApp integration settings for alerts, commands, and digests.

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  phone_number text NOT NULL,
  provider text NOT NULL DEFAULT 'twilio'
    CHECK (provider IN ('twilio', 'meta')),
  provider_config jsonb NOT NULL DEFAULT '{}',
  notification_preferences jsonb NOT NULL DEFAULT '{
    "deployment_complete": true,
    "approval_needed": true,
    "new_crm_lead": true,
    "follow_up_due": true,
    "daily_digest": true,
    "spend_alert": true
  }',
  daily_digest_time time DEFAULT '09:00',
  is_active boolean DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id)
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_business
  ON public.whatsapp_config (business_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_active
  ON public.whatsapp_config (is_active) WHERE is_active = true;

-- RLS: business members can view
CREATE POLICY "whatsapp_config_select_member"
  ON public.whatsapp_config FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- RLS: owner/admin can insert
CREATE POLICY "whatsapp_config_insert_admin"
  ON public.whatsapp_config FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- RLS: owner/admin can update
CREATE POLICY "whatsapp_config_update_admin"
  ON public.whatsapp_config FOR UPDATE
  TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_whatsapp_config_updated_at ON public.whatsapp_config;
CREATE TRIGGER set_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.whatsapp_config IS 'Per-business WhatsApp integration for agent alerts and commands';
COMMENT ON COLUMN public.whatsapp_config.provider_config IS 'Provider-specific config: Twilio {accountSid, authToken, fromNumber} or Meta {appId, appSecret, verifyToken}';
