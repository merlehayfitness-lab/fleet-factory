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
