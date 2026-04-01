/**
 * SSH connection manager for VPS deployment.
 *
 * Uses node-ssh for key-based auth, command execution, and file uploads.
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
  privateKeyPath: string;
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
  if (!privateKeyPath)
    throw new Error("VPS_SSH_KEY_PATH environment variable is required");

  return {
    host,
    port: Number(process.env.VPS_SSH_PORT) || 22,
    username: process.env.VPS_SSH_USER || "root",
    privateKeyPath,
  };
}

export function isSshConfigured(): boolean {
  return !!(process.env.VPS_SSH_HOST && process.env.VPS_SSH_KEY_PATH);
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

let activeConnection: NodeSSH | null = null;

/**
 * Get or create an SSH connection.
 * Reuses existing connection if still connected.
 */
export async function getConnection(
  config?: SshConfig,
): Promise<NodeSSH> {
  if (activeConnection?.isConnected()) {
    return activeConnection;
  }

  const cfg = config ?? getSshConfig();
  const ssh = new NodeSSH();

  await ssh.connect({
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    privateKeyPath: cfg.privateKeyPath,
    readyTimeout: 10000,
  });

  activeConnection = ssh;
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
  },
): Promise<SshCommandResult> {
  const ssh = await getConnection();

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
 * Upload content as a file on the VPS (writes locally first via putFile alternative).
 * For string content, use writeRemoteFile instead.
 */
export async function writeRemoteFile(
  remotePath: string,
  content: string,
): Promise<void> {
  const ssh = await getConnection();

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
