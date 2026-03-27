import { getVpsConfig } from "./vps-config";

/**
 * POST request to VPS with API key auth and timeout.
 * Returns parsed JSON on success, or { success: false, error: message } on failure.
 */
export async function vpsPost<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<T & { success?: boolean; error?: string }> {
  const config = getVpsConfig();
  const url = `${config.baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey,
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
 * GET request to VPS with API key auth and timeout.
 * Returns parsed JSON on success, or { success: false, error: message } on failure.
 */
export async function vpsGet<T = Record<string, unknown>>(
  path: string,
): Promise<T & { success?: boolean; error?: string }> {
  const config = getVpsConfig();
  const url = `${config.baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": config.apiKey,
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
