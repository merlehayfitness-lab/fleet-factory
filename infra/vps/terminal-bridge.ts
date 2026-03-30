/**
 * SSH WebSocket-to-SSH bridge for the embedded terminal.
 *
 * Bridges a WebSocket connection from the admin app to an SSH shell
 * on the local VPS, scoped to /data/tenants/{businessSlug}/.
 *
 * Uses ssh2 (pure JavaScript) -- no native binaries required.
 */

import { Client } from "ssh2";
import type { WebSocket } from "ws";
import { readFileSync } from "node:fs";

/**
 * Bridge a WebSocket connection to a local SSH shell.
 *
 * - SSH -> WebSocket: binary data (Buffer) from SSH stream sent directly to client
 * - WebSocket -> SSH: raw terminal input or JSON resize commands
 * - Initial directory: /data/tenants/{businessSlug}/
 */
export function bridgeTerminal(ws: WebSocket, businessSlug: string): void {
  const conn = new Client();
  let sshReady = false;

  conn.on("ready", () => {
    sshReady = true;

    conn.shell(
      { term: "xterm-256color", cols: 80, rows: 24 },
      (err, stream) => {
        if (err) {
          ws.send(`\r\nSSH shell error: ${err.message}\r\n`);
          ws.close();
          return;
        }

        // SSH -> WebSocket: forward binary data
        stream.on("data", (data: Buffer) => {
          if (ws.readyState === 1) {
            ws.send(data);
          }
        });

        // WebSocket -> SSH: handle raw input and JSON resize commands
        ws.on("message", (data: Buffer | string) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "resize" && msg.cols && msg.rows) {
              stream.setWindow(msg.rows, msg.cols, 0, 0);
              return;
            }
          } catch {
            /* not JSON, raw terminal input */
          }
          stream.write(data);
        });

        // Cleanup: SSH stream closed
        stream.on("close", () => {
          ws.close();
          conn.end();
        });

        // Cleanup: WebSocket closed
        ws.on("close", () => {
          stream.close();
          conn.end();
        });

        // Set initial directory after shell is ready
        setTimeout(() => {
          stream.write(
            `cd /data/tenants/${businessSlug} 2>/dev/null && clear\n`,
          );
        }, 100);
      },
    );
  });

  conn.on("error", (err) => {
    ws.send(`\r\nSSH connection error: ${err.message}\r\n`);
    ws.close();
  });

  // If WebSocket closes before SSH is ready, clean up
  ws.on("close", () => {
    if (!sshReady) {
      conn.end();
    }
  });

  // Connect using environment variables
  const connectConfig: Record<string, unknown> = {
    host: "127.0.0.1",
    port: 22,
    username: process.env.SSH_USER || "root",
  };

  const keyPath = process.env.SSH_PRIVATE_KEY_PATH;
  if (keyPath) {
    connectConfig.privateKey = readFileSync(keyPath);
  } else {
    connectConfig.password = process.env.SSH_PASSWORD || "";
  }

  conn.connect(connectConfig as Parameters<typeof conn.connect>[0]);
}
