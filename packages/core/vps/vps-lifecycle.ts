import { isVpsConfigured } from "./vps-config";
import { vpsPost } from "./vps-client";

interface VpsLifecycleResult {
  success: boolean;
  stoppedCount?: number;
  resumedCount?: number;
  error?: string;
}

/**
 * Stop all VPS containers for a tenant (best-effort).
 * Returns gracefully when VPS is not configured or unreachable.
 * Never throws -- callers should check `result.success`.
 */
export async function pauseTenantContainers(
  businessId: string,
  businessSlug: string,
): Promise<{ success: boolean; stoppedCount?: number; error?: string }> {
  if (!isVpsConfigured()) {
    return { success: true, stoppedCount: 0 };
  }

  try {
    const result = await vpsPost<VpsLifecycleResult>(
      "/api/tenants/stop",
      { businessId, businessSlug },
    );

    if (!result.success) {
      return { success: false, error: result.error ?? "VPS unreachable" };
    }

    return { success: true, stoppedCount: result.stoppedCount ?? 0 };
  } catch {
    return { success: false, error: "VPS unreachable" };
  }
}

/**
 * Resume all VPS containers for a tenant (best-effort).
 * Returns gracefully when VPS is not configured or unreachable.
 * Never throws -- callers should check `result.success`.
 */
export async function resumeTenantContainers(
  businessId: string,
  businessSlug: string,
): Promise<{ success: boolean; resumedCount?: number; error?: string }> {
  if (!isVpsConfigured()) {
    return { success: true, resumedCount: 0 };
  }

  try {
    const result = await vpsPost<VpsLifecycleResult>(
      "/api/tenants/resume",
      { businessId, businessSlug },
    );

    if (!result.success) {
      return { success: false, error: result.error ?? "VPS unreachable" };
    }

    return { success: true, resumedCount: result.resumedCount ?? 0 };
  } catch {
    return { success: false, error: "VPS unreachable" };
  }
}
