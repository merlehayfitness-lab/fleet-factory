import { getVpsConfig, type VpsConfig } from "./vps-config";

/**
 * POST request to VPS with API key auth and timeout.
 * Returns parsed JSON on success, or { success: false, error: message } on failure.
 * Pass a custom timeoutMs for long-running operations like chat.
 * Pass config to override global env vars (per-business VPS targets).
 */
export async function vpsPost<T = Record<string, unknown>>(
  path: string,
  body: unknown,
  timeoutMs?: number,
  config?: VpsConfig,
): Promise<T & { success?: boolean; error?: string }> {
  const cfg = config ?? getVpsConfig();
  const url = `${cfg.baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? cfg.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `VPS returned ${response.status}: ${response.statusText}`,
      } as T & { success: boolean; error: string };
    }

    return data as T & { success?: boolean; error?: string };
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error: isTimeout ? `VPS timeout after ${timeoutMs ?? cfg.timeoutMs}ms` : `VPS unreachable: ${message}`,
      _timeout: isTimeout,
    } as T & { success: boolean; error: string; _timeout?: boolean };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * GET request to VPS with API key auth and timeout.
 * Returns parsed JSON on success, or { success: false, error: message } on failure.
 * Pass config to override global env vars (per-business VPS targets).
 */
export async function vpsGet<T = Record<string, unknown>>(
  path: string,
  config?: VpsConfig,
): Promise<T & { success?: boolean; error?: string }> {
  const cfg = config ?? getVpsConfig();
  const url = `${cfg.baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": cfg.apiKey,
      },
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `VPS returned ${response.status}: ${response.statusText}`,
      } as T & { success: boolean; error: string };
    }

    return data as T & { success?: boolean; error?: string };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error: `VPS unreachable: ${message}`,
    } as T & { success: boolean; error: string };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Create an authenticated WebSocket URL for VPS communication.
 * Returns the URL string with auth token as query param.
 * Actual WebSocket is created client-side in the browser.
 */
export function createVpsWebSocket(path: string): string {
  const config = getVpsConfig();
  const wsPath = path.startsWith("/") ? path : `/${path}`;
  return `${config.wsUrl}${wsPath}?apiKey=${encodeURIComponent(config.apiKey)}`;
}
