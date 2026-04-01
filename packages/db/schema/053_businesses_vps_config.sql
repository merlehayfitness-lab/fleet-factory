-- 053_businesses_vps_config.sql
-- Add per-business VPS target config (non-sensitive: host, ssh_user, ports).
-- Sensitive credentials (ssh_password, proxy_api_key) are stored in the secrets table
-- with provider='vps'.

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS vps_config jsonb;

-- Example shape: { "host": "1.2.3.4", "ssh_user": "root", "ssh_port": 22, "proxy_port": 3100 }
