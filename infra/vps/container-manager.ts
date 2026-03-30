/**
 * Docker container lifecycle management via dockerode.
 *
 * Manages agent sandbox containers: create, start, stop, list,
 * and tenant-wide stop/resume operations.
 */

import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

/** Common sandbox base image for all agent containers */
const SANDBOX_IMAGE = "openclaw-sandbox-common:bookworm-slim";

/** Memory limit: 512MB */
const MEMORY_LIMIT = 512 * 1024 * 1024;

/** CPU limit: 0.5 CPUs in NanoCpus */
const CPU_LIMIT = 0.5 * 1e9;

/** Label used to identify Agency Factory managed containers */
const LABEL_KEY = "agency-factory";

/**
 * Create and start an agent container.
 * If a container with the same name already exists, it is stopped and removed first.
 */
export async function createAgentContainer(
  vpsAgentId: string,
  workspacePath: string,
  sharedPath: string,
): Promise<void> {
  // Check if container already exists
  try {
    const existing = docker.getContainer(vpsAgentId);
    const info = await existing.inspect();
    if (info.State.Running) {
      await existing.stop();
    }
    await existing.remove();
    console.log(`[container] Removed existing container ${vpsAgentId}`);
  } catch {
    // Container doesn't exist -- that's fine
  }

  // Derive tenant label from vpsAgentId (format: {slug}-{dept}-{prefix})
  const tenant =
    vpsAgentId.split("-").slice(0, -2).join("-") || vpsAgentId;

  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    name: vpsAgentId,
    Labels: {
      [LABEL_KEY]: "true",
      tenant,
    },
    Cmd: ["sleep", "infinity"], // Agent process managed by OpenClaw
    HostConfig: {
      Memory: MEMORY_LIMIT,
      NanoCpus: CPU_LIMIT,
      Binds: [
        `${workspacePath}:/workspace:rw`,
        `${sharedPath}:/shared:ro`,
      ],
      NetworkMode: "bridge",
      RestartPolicy: { Name: "unless-stopped" },
    },
  });

  await container.start();
  console.log(
    `[container] Created and started container ${vpsAgentId} (image: ${SANDBOX_IMAGE}, mem: 512MB, cpu: 0.5)`,
  );
}

/**
 * Start an existing agent container.
 * Ignores "already started" errors.
 */
export async function startAgentContainer(
  vpsAgentId: string,
): Promise<void> {
  try {
    await docker.getContainer(vpsAgentId).start();
    console.log(`[container] Started container ${vpsAgentId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already started") || message.includes("304")) {
      // Container is already running
      return;
    }
    throw err;
  }
}

/**
 * Stop an existing agent container.
 * Ignores "not running" errors.
 */
export async function stopAgentContainer(
  vpsAgentId: string,
): Promise<void> {
  try {
    await docker.getContainer(vpsAgentId).stop();
    console.log(`[container] Stopped container ${vpsAgentId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not running") || message.includes("304")) {
      // Container is already stopped
      return;
    }
    throw err;
  }
}

/**
 * List all Agency Factory containers for a given business slug.
 */
export async function listTenantContainers(
  businessSlug: string,
): Promise<
  Array<{ id: string; name: string; state: string; vpsAgentId: string }>
> {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: [`${LABEL_KEY}=true`] },
  });

  return containers
    .filter((c) =>
      c.Names.some((n) => n.replace(/^\//, "").includes(businessSlug)),
    )
    .map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, "") || c.Id,
      state: c.State,
      vpsAgentId: c.Names[0]?.replace(/^\//, "") || c.Id,
    }));
}

/**
 * Stop all running containers for a business.
 * Returns the number of containers stopped.
 */
export async function stopTenantContainers(
  businessSlug: string,
): Promise<number> {
  const containers = await listTenantContainers(businessSlug);
  let stoppedCount = 0;

  for (const container of containers) {
    if (container.state === "running") {
      try {
        await docker.getContainer(container.id).stop();
        stoppedCount++;
      } catch (err) {
        console.warn(
          `[container] Failed to stop ${container.vpsAgentId}:`,
          err,
        );
      }
    }
  }

  console.log(
    `[container] Stopped ${stoppedCount} containers for tenant ${businessSlug}`,
  );
  return stoppedCount;
}

/**
 * Resume (start) all stopped containers for a business.
 * Returns the number of containers started.
 */
export async function resumeTenantContainers(
  businessSlug: string,
): Promise<number> {
  const containers = await listTenantContainers(businessSlug);
  let resumedCount = 0;

  for (const container of containers) {
    if (container.state !== "running") {
      try {
        await docker.getContainer(container.id).start();
        resumedCount++;
      } catch (err) {
        console.warn(
          `[container] Failed to resume ${container.vpsAgentId}:`,
          err,
        );
      }
    }
  }

  console.log(
    `[container] Resumed ${resumedCount} containers for tenant ${businessSlug}`,
  );
  return resumedCount;
}

/**
 * Count all running Agency Factory agent containers.
 */
export async function countRunningAgents(): Promise<number> {
  const containers = await docker.listContainers({
    filters: {
      status: ["running"],
      label: [`${LABEL_KEY}=true`],
    },
  });
  return containers.length;
}

export { docker };
