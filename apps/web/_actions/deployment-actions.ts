"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  triggerDeployment,
  retryDeployment,
  rollbackDeployment,
  getDeploymentHistory,
} from "@agency-factory/core/server";

/**
 * Trigger a new deployment for a business.
 * Orchestrates the full pipeline: fetch data, generate artifacts, transition to live.
 */
export async function deployAction(businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const deployment = await triggerDeployment(supabase, businessId, user.id);
    revalidatePath(`/businesses/${businessId}/deployments`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true, deploymentId: deployment?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Deployment failed" };
  }
}

/**
 * Retry a failed deployment by creating a fresh deployment from current state.
 */
export async function retryDeploymentAction(
  businessId: string,
  deploymentId: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const deployment = await retryDeployment(
      supabase,
      businessId,
      deploymentId,
      user.id,
    );
    revalidatePath(`/businesses/${businessId}/deployments`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true, deploymentId: deployment?.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Retry failed",
    };
  }
}

/**
 * Rollback to a previous deployment version.
 * Creates a new deployment from the target version's config snapshot.
 */
export async function rollbackDeploymentAction(
  businessId: string,
  targetVersion: number,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const deployment = await rollbackDeployment(
      supabase,
      businessId,
      targetVersion,
      user.id,
    );
    revalidatePath(`/businesses/${businessId}/deployments`);
    revalidatePath(`/businesses/${businessId}`);
    return { success: true, deploymentId: deployment?.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Rollback failed",
    };
  }
}

/**
 * Get deployment history for a business.
 */
export async function getDeploymentsAction(businessId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  try {
    const deployments = await getDeploymentHistory(supabase, businessId);
    return { deployments };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch deployments",
    };
  }
}
