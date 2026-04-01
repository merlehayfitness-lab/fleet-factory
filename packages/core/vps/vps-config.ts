import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../crypto/encryption";
import type { SshConfig } from "./ssh-client";

export interface VpsConfig {
  baseUrl: string;
  apiKey: string;
  wsUrl: string;
  timeoutMs: number;
}

export function getVpsConfig(): VpsConfig {
  const baseUrl = process.env.VPS_API_URL;
  if (!baseUrl) throw new Error("VPS_API_URL environment variable is required");

  const apiKey = process.env.VPS_API_KEY;
  if (!apiKey) throw new Error("VPS_API_KEY environment variable is required");

  // Derive WebSocket URL from HTTP URL
  const wsUrl = baseUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    wsUrl,
    timeoutMs: Number(process.env.VPS_TIMEOUT_MS) || 30000,
  };
}

/**
 * Check if VPS is configured. Returns false if env vars are missing.
 * Used to gracefully degrade when VPS is not set up.
 */
export function isVpsConfigured(): boolean {
  return !!(process.env.VPS_API_URL && process.env.VPS_API_KEY);
}

/**
 * Resolve per-business VPS config from DB.
 * Queries businesses.vps_config (non-sensitive: host/ports) and
 * secrets table (sensitive: ssh_password, proxy_api_key).
 *
 * Returns null if no per-business config exists — callers should fall back
 * to global env var config in that case.
 */
export async function getVpsConfigForBusiness(
  supabase: SupabaseClient,
  businessId: string,
): Promise<{ vpsConfig: VpsConfig; sshConfig: SshConfig } | null> {
  // 1. Fetch non-sensitive VPS config from businesses table
  const { data: business } = await supabase
    .from("businesses")
    .select("vps_config")
    .eq("id", businessId)
    .single();

  const vpsConfigJson = business?.vps_config as {
    host?: string;
    ssh_user?: string;
    ssh_port?: number;
    proxy_port?: number;
  } | null;

  if (!vpsConfigJson?.host) {
    return null;
  }

  // 2. Fetch sensitive credentials from secrets table
  const { data: secrets } = await supabase
    .from("secrets")
    .select("key, encrypted_value")
    .eq("business_id", businessId)
    .eq("provider", "vps")
    .in("key", ["ssh_password", "proxy_api_key"]);

  let sshPassword: string | undefined;
  let proxyApiKey: string | undefined;

  for (const secret of secrets ?? []) {
    try {
      const decrypted = decrypt(secret.encrypted_value as string);
      if (secret.key === "ssh_password") sshPassword = decrypted;
      if (secret.key === "proxy_api_key") proxyApiKey = decrypted;
    } catch {
      // Decryption failure — skip this secret
    }
  }

  const host = vpsConfigJson.host;
  const proxyPort = vpsConfigJson.proxy_port ?? 3100;
  const baseUrl = `http://${host}:${proxyPort}`;

  const vpsConfig: VpsConfig = {
    baseUrl,
    apiKey: proxyApiKey ?? "",
    wsUrl: `ws://${host}:${proxyPort}/ws`,
    timeoutMs: 30000,
  };

  const sshConfig: SshConfig = {
    host,
    port: vpsConfigJson.ssh_port ?? 22,
    username: vpsConfigJson.ssh_user ?? "root",
    password: sshPassword,
  };

  return { vpsConfig, sshConfig };
}
