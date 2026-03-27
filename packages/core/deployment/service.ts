import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDeploymentTransition } from "./lifecycle";
import { createConfigSnapshot, type ConfigSnapshot } from "./snapshot";
import { decrypt } from "../crypto/encryption";
import {
  generateTenantConfig,
  generateDockerCompose,
  generateEnvFile,
  generateAllAgentConfigs,
  generateOpenClawWorkspace,
} from "@agency-factory/runtime";
import { isVpsConfigured } from "../vps/vps-config";
import { deriveVpsAgentId } from "../vps/vps-naming";
import { pushDeploymentToVps, pushRollbackToVps, runPostDeployHealthCheck } from "../vps/vps-deploy";

/**
 * Trigger a new deployment for a business.
 *
 * Full pipeline:
 * 1. Validate business exists and is not disabled
 * 2. Determine next version number
 * 3. Fetch agents, departments, integrations
 * 4. Create config snapshot
 * 5. Insert deployment record (queued)
 * 6. Transition through building -> deploying -> live
 * 7. Generate all runtime artifacts
 * 8. Update business and agents to active
 * 9. Create audit log
 *
 * On ANY error: transitions to 'failed' with error_message.
 */
export async function triggerDeployment(
  supabase: SupabaseClient,
  businessId: string,
  triggeredBy: string,
) {
  // 1. Fetch the business
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id, name, slug, industry, status")
    .eq("id", businessId)
    .single();

  if (bizError || !business) {
    throw new Error(
      `Business not found: ${bizError?.message ?? "No business with that ID"}`,
    );
  }

  if (business.status === "disabled") {
    throw new Error("Cannot deploy: business is disabled");
  }

  // 2. Get latest deployment version
  const { data: lastDeployment } = await supabase
    .from("deployments")
    .select("version")
    .eq("business_id", businessId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = lastDeployment ? (lastDeployment.version as number) + 1 : 1;

  // 3. Fetch agents with department info
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, name, system_prompt, tool_profile, model_profile, department_id, status")
    .eq("business_id", businessId);

  if (agentsError) {
    throw new Error(`Failed to fetch agents: ${agentsError.message}`);
  }

  // 4. Fetch departments
  const { data: departments, error: deptError } = await supabase
    .from("departments")
    .select("id, name, type")
    .eq("business_id", businessId);

  if (deptError) {
    throw new Error(`Failed to fetch departments: ${deptError.message}`);
  }

  // 5. Fetch integrations
  const { data: integrations, error: intError } = await supabase
    .from("integrations")
    .select("id, agent_id, type, provider, status, config")
    .eq("business_id", businessId);

  if (intError) {
    throw new Error(`Failed to fetch integrations: ${intError.message}`);
  }

  // 6. Create config snapshot
  const snapshot = createConfigSnapshot(
    nextVersion,
    { id: business.id, name: business.name, slug: business.slug },
    (agents ?? []).map((a) => ({
      id: a.id as string,
      name: a.name as string,
      system_prompt: (a.system_prompt as string) ?? "",
      tool_profile: (a.tool_profile as Record<string, unknown>) ?? {},
      model_profile: (a.model_profile as Record<string, unknown>) ?? {},
      department_id: a.department_id as string,
      status: a.status as string,
    })),
    (departments ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      type: d.type as string,
    })),
    (integrations ?? []).map((i) => ({
      id: i.id as string,
      agent_id: i.agent_id as string | null,
      type: i.type as string,
      provider: i.provider as string,
      status: i.status as string,
    })),
  );

  // 7. Insert deployment record as 'queued'
  const { data: deployment, error: insertError } = await supabase
    .from("deployments")
    .insert({
      business_id: businessId,
      status: "queued",
      version: nextVersion,
      triggered_by: triggeredBy,
      config_snapshot: snapshot as unknown as Record<string, unknown>,
    })
    .select("id, status, version")
    .single();

  if (insertError || !deployment) {
    throw new Error(
      `Failed to create deployment: ${insertError?.message ?? "Unknown error"}`,
    );
  }

  const deploymentId = deployment.id as string;

  // Execute the pipeline with error handling
  try {
    // 7b. SERIAL DEPLOYMENT GUARD -- Per locked decision: "Deployments processed serially (queued)"
    // Check for any active VPS deployment for this business before proceeding.
    const { data: activeDeployments } = await supabase
      .from("deployments")
      .select("id, status")
      .eq("business_id", businessId)
      .eq("deploy_target", "vps")
      .in("status", ["building", "deploying", "verifying"])
      .neq("id", deploymentId)
      .limit(1);

    if (activeDeployments && activeDeployments.length > 0) {
      // Another deployment is in progress -- keep this one queued
      await supabase
        .from("deployments")
        .update({
          status: "queued",
          config_snapshot: {
            ...(snapshot as unknown as Record<string, unknown>),
            queue_reason: `Waiting for deployment ${activeDeployments[0].id} to complete`,
          },
        })
        .eq("id", deploymentId);

      return {
        id: deploymentId,
        status: "queued",
        message: `Deployment queued -- waiting for active deployment ${activeDeployments[0].id} to finish`,
      };
    }

    // 8. Transition to 'building'
    assertDeploymentTransition("queued", "building");
    await updateDeploymentStatus(supabase, deploymentId, "building");

    // 9. Generate artifacts
    // Fetch and decrypt secrets (handle missing ENCRYPTION_KEY gracefully)
    let decryptedSecrets: Array<{ key: string; decryptedValue: string }> = [];
    try {
      const { data: secrets } = await supabase
        .from("secrets")
        .select("key, encrypted_value")
        .eq("business_id", businessId);

      if (secrets && secrets.length > 0) {
        decryptedSecrets = secrets.map((s) => ({
          key: s.key as string,
          decryptedValue: decrypt(s.encrypted_value as string),
        }));
      }
    } catch (encryptionErr) {
      // ENCRYPTION_KEY not set in development -- continue with empty secrets
      console.warn(
        "Could not decrypt secrets (ENCRYPTION_KEY may not be set):",
        encryptionErr instanceof Error ? encryptionErr.message : "Unknown error",
      );
    }

    const tenantConfig = generateTenantConfig({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        industry: business.industry as string | null,
        status: business.status,
      },
      departments: (departments ?? []).map((d) => ({
        id: d.id as string,
        name: d.name as string,
        type: d.type as string,
      })),
      agents: (agents ?? []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        status: a.status as string,
        department_id: a.department_id as string,
      })),
      deploymentVersion: nextVersion,
    });

    const dockerCompose = generateDockerCompose({
      business: { slug: business.slug },
      agents: (agents ?? []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        status: a.status as string,
      })),
      deploymentVersion: nextVersion,
    });

    const envFile = generateEnvFile({
      business: { id: business.id, slug: business.slug },
      secrets: decryptedSecrets,
      deploymentVersion: nextVersion,
    });

    // Build integrations-by-agent map
    const integrationsByAgent: Record<
      string,
      Array<{ type: string; provider: string; status: string; config: Record<string, unknown> }>
    > = {};
    for (const intg of integrations ?? []) {
      const agentId = intg.agent_id as string | null;
      if (agentId) {
        if (!integrationsByAgent[agentId]) {
          integrationsByAgent[agentId] = [];
        }
        integrationsByAgent[agentId].push({
          type: intg.type as string,
          provider: intg.provider as string,
          status: intg.status as string,
          config: (intg.config as Record<string, unknown>) ?? {},
        });
      }
    }

    const agentConfigs = generateAllAgentConfigs({
      agents: (agents ?? []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        system_prompt: (a.system_prompt as string) ?? "",
        tool_profile: (a.tool_profile as Record<string, unknown>) ?? {},
        model_profile: (a.model_profile as Record<string, unknown>) ?? {},
        department_id: a.department_id as string,
      })),
      departments: (departments ?? []).map((d) => ({
        id: d.id as string,
        name: d.name as string,
        type: d.type as string,
      })),
      integrationsByAgent,
      businessSlug: business.slug,
    });

    // Store artifacts in snapshot
    const snapshotWithArtifacts: ConfigSnapshot = {
      ...snapshot,
      artifacts: {
        tenant_config: tenantConfig,
        docker_compose: dockerCompose,
        env_file: envFile,
        agent_configs: agentConfigs.map((ac: { agentId: string; filename: string; content: string }) => ({
          agent_id: ac.agentId,
          filename: ac.filename,
          content: ac.content,
        })),
      },
    };

    // 9b. Generate OpenClaw workspace artifacts
    const openclawWorkspace = generateOpenClawWorkspace(
      {
        id: business.id,
        name: business.name,
        slug: business.slug,
        industry: (business.industry as string) ?? "general",
      },
      (agents ?? []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        department_id: a.department_id as string,
        system_prompt: (a.system_prompt as string) ?? "",
        tool_profile: (a.tool_profile as Record<string, unknown>) ?? {},
        model_profile: (a.model_profile as Record<string, unknown>) ?? {},
        status: a.status as string,
      })),
      (departments ?? []).map((d) => ({
        id: d.id as string,
        type: d.type as string,
        name: d.name as string,
      })),
      integrationsByAgent,
    );

    // Store OpenClaw artifacts in snapshot alongside legacy artifacts
    snapshotWithArtifacts.openclaw_workspace = {
      files: openclawWorkspace.files,
      config: openclawWorkspace.config,
    };

    // Update deployment with artifacts
    await supabase
      .from("deployments")
      .update({
        config_snapshot: snapshotWithArtifacts as unknown as Record<string, unknown>,
      })
      .eq("id", deploymentId);

    // 10. Transition to 'deploying'
    assertDeploymentTransition("building", "deploying");
    await updateDeploymentStatus(supabase, deploymentId, "deploying", {
      started_at: new Date().toISOString(),
    });

    // 10b. If VPS is configured, push to VPS
    if (isVpsConfigured()) {
      // Update deploy_target to 'vps'
      await supabase.from("deployments").update({ deploy_target: "vps" }).eq("id", deploymentId);

      // Build agent metadata for VPS payload
      const deptById = new Map<string, { type: string }>();
      for (const d of departments ?? []) {
        deptById.set(d.id as string, { type: d.type as string });
      }

      const vpsAgents = (agents ?? [])
        .filter((a) => (a.status as string) !== "frozen" && (a.status as string) !== "retired")
        .map((a) => {
          const dept = deptById.get(a.department_id as string);
          const deptType = dept?.type ?? "general";
          return {
            agentId: a.id as string,
            vpsAgentId: deriveVpsAgentId(business.slug, deptType, a.id as string),
            departmentType: deptType,
            model: ((a.model_profile as Record<string, unknown>)?.model as string) ?? "default",
          };
        });

      const vpsPayload = {
        businessId,
        businessSlug: business.slug,
        deploymentId,
        version: nextVersion,
        isRollback: false,
        skipOptimization: false,
        agents: vpsAgents,
        workspaceFiles: openclawWorkspace.files,
        openclawConfig: openclawWorkspace.config,
      };

      const vpsResult = await pushDeploymentToVps(supabase, deploymentId, vpsPayload);

      if (!vpsResult.success) {
        // VPS push failed but artifacts are generated -- mark as failed
        throw new Error(`VPS deployment failed: ${vpsResult.error}`);
      }

      // 10c. Transition to 'verifying' and run post-deploy health check
      assertDeploymentTransition("deploying", "verifying");
      await updateDeploymentStatus(supabase, deploymentId, "verifying");

      const healthAgents = vpsAgents.map((a) => ({
        id: a.agentId,
        vpsAgentId: a.vpsAgentId,
      }));

      const healthResult = await runPostDeployHealthCheck(supabase, businessId, healthAgents);

      if (healthResult.healthy.length === 0) {
        throw new Error("Post-deploy health check failed: no agents responding");
      }

      // If some agents are unhealthy, log but continue (partial failure)
      if (healthResult.unhealthy.length > 0 && healthResult.healthy.length > 0) {
        console.warn(
          `Partial deployment: ${healthResult.unhealthy.length} unhealthy agents out of ${healthAgents.length}`,
        );
      }

      // Transition verifying -> live
      assertDeploymentTransition("verifying", "live");
      await updateDeploymentStatus(supabase, deploymentId, "live", {
        completed_at: new Date().toISOString(),
      });
    } else {
      // If VPS not configured, continue with existing local-only path
      assertDeploymentTransition("deploying", "live");
      await updateDeploymentStatus(supabase, deploymentId, "live", {
        completed_at: new Date().toISOString(),
      });
    }

    // 12. Update agents to 'active' if provisioning
    await supabase
      .from("agents")
      .update({ status: "active" })
      .eq("business_id", businessId)
      .eq("status", "provisioning");

    // 13. Update business to 'active' if provisioning
    await supabase
      .from("businesses")
      .update({ status: "active" })
      .eq("id", businessId)
      .eq("status", "provisioning");

    // 14. Audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "deployment.completed",
      entity_type: "deployment",
      entity_id: deploymentId,
      metadata: {
        version: nextVersion,
        agent_count: (agents ?? []).length,
      },
    });

    if (auditError) {
      console.error("Failed to create audit log:", auditError.message);
    }

    // Return the deployment record
    const { data: finalDeployment } = await supabase
      .from("deployments")
      .select("*")
      .eq("id", deploymentId)
      .single();

    return finalDeployment;
  } catch (err) {
    // 15. On ANY error: transition to 'failed'
    const errorMessage = err instanceof Error ? err.message : "Unknown deployment error";

    await updateDeploymentStatus(supabase, deploymentId, "failed", {
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    }).catch((updateErr) => {
      console.error("Failed to update deployment to failed state:", updateErr);
    });

    // Audit log for failure
    await supabase
      .from("audit_logs")
      .insert({
        business_id: businessId,
        action: "deployment.failed",
        entity_type: "deployment",
        entity_id: deploymentId,
        metadata: {
          version: nextVersion,
          error: errorMessage,
        },
      })
      .then(({ error: auditError }) => {
        if (auditError) {
          console.error("Failed to create failure audit log:", auditError.message);
        }
      });

    // Return the failed deployment
    const { data: failedDeployment } = await supabase
      .from("deployments")
      .select("*")
      .eq("id", deploymentId)
      .single();

    return failedDeployment;
  }
}

/**
 * Retry a failed deployment by creating a fresh deployment from current state.
 */
export async function retryDeployment(
  supabase: SupabaseClient,
  businessId: string,
  failedDeploymentId: string,
  triggeredBy: string,
) {
  // Verify the deployment is actually failed
  const { data: failedDeployment, error } = await supabase
    .from("deployments")
    .select("id, status, version")
    .eq("id", failedDeploymentId)
    .eq("business_id", businessId)
    .single();

  if (error || !failedDeployment) {
    throw new Error(
      `Deployment not found: ${error?.message ?? "No deployment with that ID in this business"}`,
    );
  }

  if (failedDeployment.status !== "failed") {
    throw new Error(
      `Cannot retry deployment: status is '${failedDeployment.status}', expected 'failed'`,
    );
  }

  // Create a fresh deployment from current state
  return triggerDeployment(supabase, businessId, triggeredBy);
}

/**
 * Rollback to a previous deployment version by creating a new deployment
 * from the target version's config snapshot.
 */
export async function rollbackDeployment(
  supabase: SupabaseClient,
  businessId: string,
  targetVersion: number,
  triggeredBy: string,
) {
  // 1. Fetch the target deployment
  const { data: targetDeployment, error: targetError } = await supabase
    .from("deployments")
    .select("id, status, version, config_snapshot")
    .eq("business_id", businessId)
    .eq("version", targetVersion)
    .single();

  if (targetError || !targetDeployment) {
    throw new Error(
      `Target deployment not found: ${targetError?.message ?? `No deployment with version ${targetVersion}`}`,
    );
  }

  // Verify the target was live or rolled_back (had a successful deployment)
  if (targetDeployment.status !== "live" && targetDeployment.status !== "rolled_back") {
    throw new Error(
      `Cannot rollback to version ${targetVersion}: status is '${targetDeployment.status}', expected 'live' or 'rolled_back'`,
    );
  }

  // 2. Get next version number
  const { data: lastDeployment } = await supabase
    .from("deployments")
    .select("version")
    .eq("business_id", businessId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = lastDeployment ? (lastDeployment.version as number) + 1 : 1;

  // 3. Create new deployment with the old config snapshot
  const oldSnapshot = targetDeployment.config_snapshot as unknown as ConfigSnapshot;
  const newSnapshot: ConfigSnapshot = {
    ...oldSnapshot,
    version: nextVersion,
    generated_at: new Date().toISOString(),
  };

  const { data: newDeployment, error: insertError } = await supabase
    .from("deployments")
    .insert({
      business_id: businessId,
      status: "queued",
      version: nextVersion,
      triggered_by: triggeredBy,
      config_snapshot: newSnapshot as unknown as Record<string, unknown>,
      rolled_back_to: targetVersion,
    })
    .select("id, status, version")
    .single();

  if (insertError || !newDeployment) {
    throw new Error(
      `Failed to create rollback deployment: ${insertError?.message ?? "Unknown error"}`,
    );
  }

  const deploymentId = newDeployment.id as string;

  try {
    // 4. Transition through building -> deploying -> (verifying) -> live
    assertDeploymentTransition("queued", "building");
    await updateDeploymentStatus(supabase, deploymentId, "building");

    assertDeploymentTransition("building", "deploying");
    await updateDeploymentStatus(supabase, deploymentId, "deploying", {
      started_at: new Date().toISOString(),
    });

    // 4b. If VPS is configured, push rollback to VPS with skipOptimization=true
    if (isVpsConfigured() && oldSnapshot.openclaw_workspace) {
      await supabase.from("deployments").update({ deploy_target: "vps" }).eq("id", deploymentId);

      // Build agent metadata from snapshot
      const deptById = new Map<string, { type: string }>();
      for (const d of oldSnapshot.departments ?? []) {
        deptById.set(d.id, { type: d.type });
      }

      const rollbackAgents = (oldSnapshot.agents ?? [])
        .filter((a) => a.status !== "frozen" && a.status !== "retired")
        .map((a) => {
          const dept = deptById.get(a.department_id);
          const deptType = dept?.type ?? "general";
          return {
            agentId: a.id,
            vpsAgentId: deriveVpsAgentId(oldSnapshot.business.slug, deptType, a.id),
            departmentType: deptType,
            model: ((a.model_profile as Record<string, unknown>)?.model as string) ?? "default",
          };
        });

      const vpsResult = await pushRollbackToVps(
        supabase,
        deploymentId,
        businessId,
        oldSnapshot.business.slug,
        nextVersion,
        rollbackAgents,
        oldSnapshot.openclaw_workspace.files,
        oldSnapshot.openclaw_workspace.config,
      );

      if (!vpsResult.success) {
        throw new Error(`VPS rollback failed: ${vpsResult.error}`);
      }

      // Run post-deploy health check
      assertDeploymentTransition("deploying", "verifying");
      await updateDeploymentStatus(supabase, deploymentId, "verifying");

      const healthAgents = rollbackAgents.map((a) => ({
        id: a.agentId,
        vpsAgentId: a.vpsAgentId,
      }));

      const healthResult = await runPostDeployHealthCheck(supabase, businessId, healthAgents);

      if (healthResult.healthy.length === 0) {
        throw new Error("Post-rollback health check failed: no agents responding");
      }

      assertDeploymentTransition("verifying", "live");
      await updateDeploymentStatus(supabase, deploymentId, "live", {
        completed_at: new Date().toISOString(),
      });
    } else {
      // Local-only fallback
      assertDeploymentTransition("deploying", "live");
      await updateDeploymentStatus(supabase, deploymentId, "live", {
        completed_at: new Date().toISOString(),
      });
    }

    // 5. Mark the currently-live deployment as 'rolled_back'
    const { data: currentLive } = await supabase
      .from("deployments")
      .select("id, status")
      .eq("business_id", businessId)
      .eq("status", "live")
      .neq("id", deploymentId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (currentLive) {
      await updateDeploymentStatus(supabase, currentLive.id as string, "rolled_back");
    }

    // 6. Audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "deployment.rolled_back",
      entity_type: "deployment",
      entity_id: deploymentId,
      metadata: {
        from_version: currentLive
          ? (await supabase
              .from("deployments")
              .select("version")
              .eq("id", currentLive.id as string)
              .single()
            ).data?.version
          : null,
        to_version: targetVersion,
        new_version: nextVersion,
      },
    });

    if (auditError) {
      console.error("Failed to create rollback audit log:", auditError.message);
    }

    // Return the new deployment
    const { data: finalDeployment } = await supabase
      .from("deployments")
      .select("*")
      .eq("id", deploymentId)
      .single();

    return finalDeployment;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown rollback error";

    await updateDeploymentStatus(supabase, deploymentId, "failed", {
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    }).catch((updateErr) => {
      console.error("Failed to update rollback deployment to failed state:", updateErr);
    });

    await supabase
      .from("audit_logs")
      .insert({
        business_id: businessId,
        action: "deployment.failed",
        entity_type: "deployment",
        entity_id: deploymentId,
        metadata: {
          version: nextVersion,
          error: errorMessage,
          rollback_target: targetVersion,
        },
      })
      .then(({ error: auditError }) => {
        if (auditError) {
          console.error("Failed to create rollback failure audit log:", auditError.message);
        }
      });

    const { data: failedDeployment } = await supabase
      .from("deployments")
      .select("*")
      .eq("id", deploymentId)
      .single();

    return failedDeployment;
  }
}

/**
 * Get deployment history for a business, ordered by newest first.
 */
export async function getDeploymentHistory(
  supabase: SupabaseClient,
  businessId: string,
  limit = 20,
) {
  const { data, error } = await supabase
    .from("deployments")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch deployment history: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Helper: update deployment status and optional extra fields.
 */
async function updateDeploymentStatus(
  supabase: SupabaseClient,
  deploymentId: string,
  status: string,
  extraFields?: Record<string, unknown>,
) {
  const updatePayload: Record<string, unknown> = { status, ...extraFields };

  const { error } = await supabase
    .from("deployments")
    .update(updatePayload)
    .eq("id", deploymentId);

  if (error) {
    throw new Error(`Failed to update deployment to '${status}': ${error.message}`);
  }
}
