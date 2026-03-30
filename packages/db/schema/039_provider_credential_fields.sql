-- 039: Provider credential field definitions
-- Drives dynamic credential forms per integration provider.
-- Field definitions are global (not per-tenant) -- seeded with all 15 catalog providers.

CREATE TABLE IF NOT EXISTS public.provider_credential_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'password'
    CHECK (field_type IN ('password', 'text', 'url')),
  display_label text NOT NULL,
  placeholder text,
  help_text text,
  field_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- One field per provider+field_name combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_credential_fields_provider_field
  ON public.provider_credential_fields (provider, field_name);

-- Lookup by provider
CREATE INDEX IF NOT EXISTS idx_provider_credential_fields_provider
  ON public.provider_credential_fields (provider);

-- RLS: anyone authenticated can read field definitions (they are not sensitive)
ALTER TABLE public.provider_credential_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_credential_fields_select_authenticated"
  ON public.provider_credential_fields FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies -- only service_role can modify

-- Seed field definitions for all 15 catalog providers
INSERT INTO public.provider_credential_fields (provider, field_name, field_type, display_label, placeholder, help_text, field_order)
VALUES
  -- HubSpot (CRM)
  ('hubspot', 'api_key', 'password', 'API Key', NULL, 'Found in Settings > Integrations > API key', 0),

  -- Salesforce (CRM)
  ('salesforce', 'instance_url', 'url', 'Instance URL', 'https://yourcompany.my.salesforce.com', NULL, 0),
  ('salesforce', 'client_id', 'text', 'Client ID', NULL, NULL, 1),
  ('salesforce', 'client_secret', 'password', 'Client Secret', NULL, NULL, 2),

  -- Pipedrive (CRM)
  ('pipedrive', 'api_token', 'password', 'API Token', NULL, 'Found in Settings > Personal Preferences > API', 0),

  -- SendGrid (Email)
  ('sendgrid', 'api_key', 'password', 'API Key', NULL, 'Full access or restricted API key', 0),

  -- Mailgun (Email)
  ('mailgun', 'api_key', 'password', 'API Key', NULL, NULL, 0),
  ('mailgun', 'domain', 'text', 'Sending Domain', 'mg.yourdomain.com', 'e.g. mg.yourdomain.com', 1),

  -- Amazon SES (Email)
  ('ses', 'access_key_id', 'text', 'Access Key ID', NULL, NULL, 0),
  ('ses', 'secret_access_key', 'password', 'Secret Access Key', NULL, NULL, 1),
  ('ses', 'region', 'text', 'AWS Region', 'us-east-1', 'e.g. us-east-1', 2),

  -- Zendesk (Helpdesk)
  ('zendesk', 'subdomain', 'text', 'Subdomain', 'yourcompany', 'yourcompany.zendesk.com', 0),
  ('zendesk', 'email', 'text', 'Admin Email', NULL, NULL, 1),
  ('zendesk', 'api_token', 'password', 'API Token', NULL, NULL, 2),

  -- Freshdesk (Helpdesk)
  ('freshdesk', 'domain', 'text', 'Domain', 'yourcompany', 'yourcompany.freshdesk.com', 0),
  ('freshdesk', 'api_key', 'password', 'API Key', NULL, NULL, 1),

  -- Intercom (Helpdesk)
  ('intercom', 'access_token', 'password', 'Access Token', NULL, 'From Developer Hub > Your App', 0),

  -- Google Calendar (Calendar)
  ('google-calendar', 'client_id', 'text', 'Client ID', NULL, NULL, 0),
  ('google-calendar', 'client_secret', 'password', 'Client Secret', NULL, NULL, 1),
  ('google-calendar', 'refresh_token', 'password', 'Refresh Token', NULL, NULL, 2),

  -- Outlook Calendar (Calendar)
  ('outlook-calendar', 'client_id', 'text', 'Client ID', NULL, NULL, 0),
  ('outlook-calendar', 'client_secret', 'password', 'Client Secret', NULL, NULL, 1),
  ('outlook-calendar', 'tenant_id', 'text', 'Tenant ID', NULL, NULL, 2),

  -- Calendly (Calendar)
  ('calendly', 'api_key', 'password', 'Personal Access Token', NULL, 'From Integrations page', 0),

  -- Slack (Messaging)
  ('slack', 'bot_token', 'password', 'Bot Token', 'xoxb-xxxx...', NULL, 0),
  ('slack', 'signing_secret', 'password', 'Signing Secret', NULL, 'From Basic Information > App Credentials', 1),

  -- Microsoft Teams (Messaging)
  ('teams', 'app_id', 'text', 'App ID', NULL, NULL, 0),
  ('teams', 'app_password', 'password', 'App Password', NULL, NULL, 1),

  -- Discord (Messaging)
  ('discord', 'bot_token', 'password', 'Bot Token', NULL, NULL, 0),
  ('discord', 'application_id', 'text', 'Application ID', NULL, NULL, 1)
ON CONFLICT DO NOTHING;
