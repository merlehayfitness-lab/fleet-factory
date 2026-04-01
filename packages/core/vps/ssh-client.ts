/**
 * SSH connection manager for VPS deployment.
 *
 * Uses node-ssh for key-based or password auth, command execution, and file uploads.
 * Connection is reused within a deployment session then disconnected.
 */

import { NodeSSH } from "node-ssh";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SshConfig {
  host: string;
  port: number;
  username: string;
  /** Path to private key file. Use instead of password. */
  privateKeyPath?: string;
  /** Password auth. Used when privateKeyPath is not set. */
  password?: string;
}

export interface SshCommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export type SshProgressCallback = (line: string) => void;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function getSshConfig(): SshConfig {
  const host = process.env.VPS_SSH_HOST;
  if (!host) throw new Error("VPS_SSH_HOST environment variable is required");

  const privateKeyPath = process.env.VPS_SSH_KEY_PATH;
  const password = process.env.VPS_SSH_PASSWORD;

  if (!privateKeyPath && !password) {
    throw new Error("VPS_SSH_KEY_PATH or VPS_SSH_PASSWORD environment variable is required");
  }

  return {
    host,
    port: Number(process.env.VPS_SSH_PORT) || 22,
    username: process.env.VPS_SSH_USER || "root",
    privateKeyPath: privateKeyPath || undefined,
    password: password || undefined,
  };
}

export function isSshConfigured(overrideConfig?: SshConfig): boolean {
  if (overrideConfig) {
    return !!(overrideConfig.host && (overrideConfig.privateKeyPath || overrideConfig.password));
  }
  return !!(process.env.VPS_SSH_HOST && (process.env.VPS_SSH_KEY_PATH || process.env.VPS_SSH_PASSWORD));
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

let activeConnection: NodeSSH | null = null;

/**
 * Get or create an SSH connection.
 * Reuses existing connection if still connected.
 * If a config override is provided, always creates a fresh connection.
 */
export async function getConnection(
  config?: SshConfig,
): Promise<NodeSSH> {
  // If a custom config is provided, don't reuse the global connection
  if (!config && activeConnection?.isConnected()) {
    return activeConnection;
  }

  const cfg = config ?? getSshConfig();
  const ssh = new NodeSSH();

  const connectOptions: Parameters<NodeSSH["connect"]>[0] = {
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    readyTimeout: 10000,
  };

  if (cfg.privateKeyPath) {
    connectOptions.privateKeyPath = cfg.privateKeyPath;
  } else if (cfg.password) {
    connectOptions.password = cfg.password;
  }

  await ssh.connect(connectOptions);

  // Only cache the global (no-override) connection
  if (!config) {
    activeConnection = ssh;
  }

  return ssh;
}

/**
 * Disconnect the active SSH connection.
 */
export function disconnect(): void {
  if (activeConnection?.isConnected()) {
    activeConnection.dispose();
  }
  activeConnection = null;
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

/**
 * Execute a command on the VPS via SSH.
 * Optionally streams stdout/stderr lines to a callback.
 */
export async function execCommand(
  command: string,
  options?: {
    cwd?: string;
    onStdout?: SshProgressCallback;
    onStderr?: SshProgressCallback;
    timeout?: number;
    sshConfig?: SshConfig;
  },
): Promise<SshCommandResult> {
  const ssh = await getConnection(options?.sshConfig);

  const result = await ssh.execCommand(command, {
    cwd: options?.cwd,
    onStdout: options?.onStdout
      ? (chunk) => {
          const lines = chunk.toString().split("\n").filter(Boolean);
          for (const line of lines) options.onStdout!(line);
        }
      : undefined,
    onStderr: options?.onStderr
      ? (chunk) => {
          const lines = chunk.toString().split("\n").filter(Boolean);
          for (const line of lines) options.onStderr!(line);
        }
      : undefined,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    code: result.code,
  };
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

/**
 * Upload a single file to the VPS via SFTP.
 */
export async function uploadFile(
  localPath: string,
  remotePath: string,
): Promise<void> {
  const ssh = await getConnection();
  await ssh.putFile(localPath, remotePath);
}

/**
 * Upload content as a file on the VPS.
 * For string content, use this instead of uploadFile.
 */
export async function writeRemoteFile(
  remotePath: string,
  content: string,
  sshConfig?: SshConfig,
): Promise<void> {
  const ssh = await getConnection(sshConfig);

  // Ensure parent directory exists
  const dir = remotePath.substring(0, remotePath.lastIndexOf("/"));
  await ssh.execCommand(`mkdir -p "${dir}"`);

  // Use heredoc to write content directly without temp files
  const escaped = content.replace(/'/g, "'\\''");
  await ssh.execCommand(`cat > '${remotePath}' << 'SSHEOF'\n${escaped}\nSSHEOF`);
}

/**
 * Upload a directory to the VPS via SFTP.
 */
export async function uploadDirectory(
  localDir: string,
  remoteDir: string,
): Promise<void> {
  const ssh = await getConnection();
  await ssh.putDirectory(localDir, remoteDir, {
    recursive: true,
    concurrency: 5,
  });
}

/**
 * Read a remote file's content.
 */
export async function readRemoteFile(remotePath: string): Promise<string> {
  const result = await execCommand(`cat "${remotePath}"`);
  if (result.code !== 0) {
    throw new Error(`Failed to read ${remotePath}: ${result.stderr}`);
  }
  return result.stdout;
}

/**
 * Check if a remote path exists.
 */
export async function remotePathExists(remotePath: string): Promise<boolean> {
  const result = await execCommand(`test -e "${remotePath}" && echo "exists"`);
  return result.stdout.trim() === "exists";
}
