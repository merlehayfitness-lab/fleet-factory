# Phase 17: VPS Activation & Embedded Terminal - Research

**Researched:** 2026-03-30
**Domain:** VPS deployment activation, browser-based SSH terminal, Docker container management, OpenClaw gateway integration
**Confidence:** MEDIUM

## Summary

Phase 17 activates the VPS infrastructure that has been scaffolded since Phase 6. The codebase already contains extensive VPS proxy code (`infra/vps/`), client libraries (`packages/core/vps/`), and UI integration points (health dashboard, deployment progress stream, chat/task routing). All six stubbed areas in `api-routes.ts` and `api-server.ts` need real implementations. The embedded terminal requires xterm.js on the frontend connected via WebSocket to an SSH session on the VPS proxy server using the `ssh2` library.

The VPS proxy (`infra/vps/`) is a standalone Express + WebSocket server on port 3100. It already has API key auth, CORS, JSON body parsing, and WebSocket upgrade handling. The terminal WebSocket endpoint is a new addition alongside the existing `/ws/deploy/:id` and `/ws/chat/:conversationId` paths. For Docker container management, the `dockerode` library provides programmatic access to the Docker API. For OpenClaw agent interaction, the gateway exposes REST endpoints at `POST /api/sessions/:key/messages` and `POST /v1/chat/completions` with Bearer token auth.

**Primary recommendation:** Use `ssh2` (pure JS, no native deps) on the VPS proxy to bridge WebSocket-to-SSH, `@xterm/xterm` v6 + `@xterm/addon-fit` + `@xterm/addon-web-links` on the frontend, and `dockerode` for container lifecycle management. Do NOT use `node-pty` (requires native compilation, and the terminal connects to a remote VPS, not a local shell).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full SSH shell, restricted to platform-level admins only (not business owners)
- Terminal sessions scoped to the business tenant's directory on VPS (`/data/tenants/{businessSlug}/`)
- Connection goes through the existing VPS API proxy (new WebSocket endpoint on Express server port 3100), reusing API key auth -- no SSH keys needed in browser
- Terminal session persists while navigating within business pages -- only dies when leaving the business or closing the tab
- **All 6 stubbed areas replaced** with real implementations (Claude Code optimization, Docker container management, Chat routing, Task execution routing, WebSocket deployment progress streaming, WebSocket chat token streaming)
- `/api/tenants/stop` and `/api/tenants/resume` endpoints also implemented
- VPS initial setup is a **manual checklist** -- automation deferred
- Deployment state persisted to **JSON files on VPS** (survives proxy restarts)
- **One container per agent** (openclaw-sandbox-common image, 512MB, 0.5 CPUs)
- Chat/task routing goes through **OpenClaw gateway** (ws://127.0.0.1:18789)
- **Real WebSocket streaming** for both deploy progress events and chat tokens
- If Claude Code optimization fails, **deployment fails**
- **Standalone page** at `/businesses/[id]/terminal`
- Accessed via **gear icon on VPS status badge** on the health dashboard (no sidebar nav entry)
- Page shows terminal + **info bar** at top with VPS status, connected tenant, agent container count, and disconnect button
- **Dark terminal theme** -- classic dark background with green/white text
- "First real agent running" means the **full loop**: deploy, chat, task, approval
- Agents use **real Claude API responses** (Anthropic API with system prompts)
- Verification is **manual testing** -- automated smoke test deferred
- When agent fails to respond: **both agent-level error badge AND deployment marked as degraded**
- **Approval flow routes back to Supabase** -- agent pauses, sends approval request to Supabase via API, admin approves in admin panel, decision flows back to VPS
- VPS health check **auto-polls every 30s**
- Agent **memory persists across redeployments**

### Claude's Discretion
- xterm.js addon selection and terminal configuration
- WebSocket reconnection strategy for terminal sessions
- Exact layout and styling of terminal info bar
- File-based persistence format for VPS deployment state
- VPS API route implementation details for container management

### Deferred Ideas (OUT OF SCOPE)
- Automated VPS provisioning script (one-click setup)
- Automated smoke test / health check script
- Terminal access for business owners (currently platform admin only)
- Sidebar nav entry for Terminal
- Bottom drawer terminal (VS Code style)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VPS-TERM-01 | First real department/agent deployed and running on Hostinger VPS | Activate all 6 stubbed areas in api-routes.ts: Claude Code optimization via OpenClaw gateway, Docker container management via dockerode, real chat/task routing via OpenClaw REST API, real WebSocket streaming. Use openclaw gateway POST /api/sessions/:key/messages for agent interaction. |
| VPS-TERM-02 | Gear icon next to VPS status badge links to standalone terminal page | Add gear icon (Settings/Cog from lucide-react) next to VpsStatusIndicator in health-dashboard.tsx, linking to `/businesses/${business.id}/terminal`. Icon only visible when VPS is configured. |
| VPS-TERM-03 | Embedded real-time SSH terminal for direct VPS access from admin panel | xterm.js v6 (@xterm/xterm) + @xterm/addon-fit + @xterm/addon-web-links on frontend. ssh2 library on VPS proxy for WebSocket-to-SSH bridge. New /ws/terminal/:businessSlug WebSocket path in api-server.ts. |
| VPS-TERM-04 | Admin can access deployed agents and Docker containers from embedded terminal | Terminal session starts in /data/tenants/{businessSlug}/ directory. SSH shell has full access to docker commands, openclaw CLI, and filesystem. dockerode used by API routes for programmatic container management. |
| VPS-TERM-05 | End-to-end VPS deployment pipeline verified with real agents | Manual test scenario: create business, deploy to VPS, chat with agent, send task, see approval, approve, verify result. Requires all stub replacements working together. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xterm/xterm | 6.0.0 | Browser terminal emulator | Industry standard for web terminals, used by VS Code, Gitpod, Theia |
| @xterm/addon-fit | 0.11.0 | Auto-resize terminal to container | Required for responsive terminal layout |
| @xterm/addon-web-links | 0.12.0 | Clickable URLs in terminal output | Quality-of-life for terminal UX |
| ssh2 | 1.16.0 | Pure JS SSH2 client for Node.js | No native dependencies, works on any platform, battle-tested |
| dockerode | 4.0.9 | Docker Remote API client for Node.js | Standard Docker management from Node, Promise-based API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/ssh2 | 1.15.x | TypeScript types for ssh2 | Dev dependency for type safety |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ssh2 | node-pty | node-pty requires native compilation and is for LOCAL shells, not remote SSH |
| ssh2 | webssh2-server | Full solution but overkill, brings socket.io dependency, harder to customize |
| dockerode | child_process docker CLI | dockerode is cleaner API, no shell escaping issues, proper TypeScript |
| @xterm/addon-attach | Manual WebSocket handling | addon-attach is for simple text relay; SSH needs binary/resize handling, so manual WS is better |

**Installation (VPS proxy -- infra/vps/):**
```bash
npm install ssh2 dockerode && npm install -D @types/ssh2
```

**Installation (Admin app -- apps/web/):**
```bash
pnpm add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
```

## Architecture Patterns

### Recommended Project Structure
```
infra/vps/
  api-server.ts          # Add /ws/terminal/:businessSlug WebSocket path
  api-routes.ts          # Replace all 6 stubs with real implementations
  api-types.ts           # Add terminal types, tenant lifecycle types
  terminal-bridge.ts     # NEW: ssh2 WebSocket-to-SSH bridge
  container-manager.ts   # NEW: dockerode wrapper for container lifecycle
  deploy-state.ts        # NEW: JSON file persistence for deployment state
  openclaw-client.ts     # NEW: OpenClaw gateway HTTP client

apps/web/
  app/(dashboard)/businesses/[id]/terminal/
    page.tsx             # Server Component: auth check, VPS config, render terminal
  _components/
    embedded-terminal.tsx # Client Component: xterm.js + WebSocket
    terminal-info-bar.tsx # Client Component: status bar above terminal
```

### Pattern 1: WebSocket-to-SSH Bridge (VPS Proxy)
**What:** Browser WebSocket connects to VPS proxy, proxy spawns ssh2 shell to localhost, bridges data bidirectionally
**When to use:** For the embedded terminal feature
**Example:**
```typescript
// infra/vps/terminal-bridge.ts
import { Client } from 'ssh2';
import type { WebSocket } from 'ws';

export function bridgeTerminal(ws: WebSocket, businessSlug: string): void {
  const conn = new Client();

  conn.on('ready', () => {
    conn.shell(
      { term: 'xterm-256color', cols: 80, rows: 24 },
      (err, stream) => {
        if (err) { ws.close(1011, 'Shell spawn failed'); return; }

        // Bridge: SSH stream <-> WebSocket
        stream.on('data', (data: Buffer) => {
          if (ws.readyState === 1) ws.send(data);
        });

        ws.on('message', (data: Buffer) => {
          // Parse for resize commands vs terminal input
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'resize') {
              stream.setWindow(msg.rows, msg.cols, 0, 0);
              return;
            }
          } catch { /* not JSON, raw terminal data */ }
          stream.write(data);
        });

        stream.on('close', () => ws.close());
        ws.on('close', () => { stream.close(); conn.end(); });

        // cd to tenant directory on connect
        stream.write(`cd /data/tenants/${businessSlug} && clear\n`);
      }
    );
  });

  conn.connect({
    host: '127.0.0.1',
    port: 22,
    username: process.env.SSH_USER || 'root',
    password: process.env.SSH_PASSWORD,
    // Or use privateKey: fs.readFileSync('/root/.ssh/id_rsa')
  });
}
```

### Pattern 2: xterm.js Client Component (Next.js)
**What:** Dynamic import of xterm.js in a client component (avoids SSR issues)
**When to use:** For the terminal page
**Example:**
```typescript
// apps/web/_components/embedded-terminal.tsx
"use client";
import { useEffect, useRef } from "react";

export function EmbeddedTerminal({ wsUrl }: { wsUrl: string }) {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let terminal: any;
    let ws: WebSocket;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");
      // Must import CSS
      await import("@xterm/xterm/css/xterm.css");

      terminal = new Terminal({
        cursorBlink: true,
        theme: { background: "#1a1a2e", foreground: "#e0e0e0", cursor: "#00ff41" },
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 14,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());
      terminal.open(termRef.current!);
      fitAddon.fit();

      // WebSocket connection
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      ws.onmessage = (e) => terminal.write(new Uint8Array(e.data));
      terminal.onData((data: string) => ws.send(data));
      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      });

      // Handle window resize
      const resizeObserver = new ResizeObserver(() => fitAddon.fit());
      resizeObserver.observe(termRef.current!);
    }

    init();
    return () => { terminal?.dispose(); ws?.close(); };
  }, [wsUrl]);

  return <div ref={termRef} className="h-full w-full" />;
}
```

### Pattern 3: OpenClaw Gateway Integration (Real Agent Routing)
**What:** Replace stub chat/task handlers with real OpenClaw gateway HTTP calls
**When to use:** For activating real agent responses
**Example:**
```typescript
// infra/vps/openclaw-client.ts
const GATEWAY_URL = process.env.OPENCLAW_HTTP_URL || "http://127.0.0.1:18789";
const AUTH_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || "";

export async function sendMessageToAgent(
  agentId: string,
  sessionKey: string,
  message: string,
): Promise<{ response: string; model: string; tokens: number }> {
  const res = await fetch(`${GATEWAY_URL}/api/sessions/${sessionKey}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) throw new Error(`OpenClaw error: ${res.status}`);
  return res.json();
}
```

### Pattern 4: Docker Container Management via dockerode
**What:** Programmatic container start/stop/list using Docker Remote API
**When to use:** For deploy step 4 (container management), tenant stop/resume
**Example:**
```typescript
// infra/vps/container-manager.ts
import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function startAgentContainer(vpsAgentId: string, workspacePath: string) {
  const container = await docker.createContainer({
    Image: 'openclaw-sandbox-common:bookworm-slim',
    name: vpsAgentId,
    HostConfig: {
      Memory: 512 * 1024 * 1024, // 512MB
      NanoCpus: 0.5 * 1e9,       // 0.5 CPUs
      Binds: [
        `${workspacePath}:/workspace:rw`,
        `${workspacePath}/../shared:/shared:ro`,
      ],
      NetworkMode: 'bridge',
    },
  });
  await container.start();
  return container;
}

export async function listTenantContainers(businessSlug: string) {
  const containers = await docker.listContainers({ all: true });
  return containers.filter(c => c.Names.some(n => n.includes(businessSlug)));
}

export async function stopTenantContainers(businessSlug: string) {
  const containers = await listTenantContainers(businessSlug);
  let stoppedCount = 0;
  for (const info of containers) {
    if (info.State === 'running') {
      const container = docker.getContainer(info.Id);
      await container.stop();
      stoppedCount++;
    }
  }
  return stoppedCount;
}
```

### Pattern 5: JSON File Persistence for Deployment State
**What:** Persist deployment state to JSON files instead of in-memory Map
**When to use:** For surviving proxy restarts
**Example:**
```typescript
// infra/vps/deploy-state.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

const STATE_DIR = process.env.STATE_DIR || '/data/state';

export function saveDeploymentState(deployId: string, state: DeploymentState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(STATE_DIR, `deploy-${deployId}.json`),
    JSON.stringify(state, null, 2),
  );
}

export function loadDeploymentState(deployId: string): DeploymentState | null {
  const filePath = path.join(STATE_DIR, `deploy-${deployId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
```

### Anti-Patterns to Avoid
- **DO NOT use node-pty on VPS proxy:** node-pty spawns a local PTY. The terminal connects to the VPS's own SSH daemon -- use ssh2 which is pure JS and connects to localhost:22.
- **DO NOT use @xterm/addon-attach for terminal:** addon-attach expects simple text relay. SSH needs binary data handling and resize events, which require manual WebSocket message handling.
- **DO NOT import xterm.js at module level in Next.js:** xterm.js accesses DOM APIs. Use dynamic import inside useEffect to avoid SSR errors.
- **DO NOT store SSH credentials in browser:** All SSH happens server-side on the VPS proxy. Browser only sends terminal data over the authenticated WebSocket.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal emulation in browser | Custom canvas/DOM terminal | @xterm/xterm | Full VT100/VT220/xterm compat, Unicode, ANSI escape codes |
| SSH connection from Node.js | Raw TCP socket + SSH protocol | ssh2 | SSH protocol is complex (key exchange, encryption, channels) |
| Docker container management | child_process + docker CLI | dockerode | Type-safe, no shell injection, Promise API, stream support |
| Terminal resize handling | Custom resize detection | @xterm/addon-fit + ResizeObserver | Handles all edge cases (font metrics, container size changes) |
| WebSocket reconnection | Custom retry logic | Exponential backoff with jitter | Terminal shows "Reconnecting..." message, auto-reconnects |

**Key insight:** The terminal stack (xterm.js + ssh2 + WebSocket) is a well-established pattern with clear separation of concerns. The browser renders, the proxy bridges, and SSH handles the actual shell. Trying to build any of these layers from scratch would be a massive effort for an inferior result.

## Common Pitfalls

### Pitfall 1: xterm.js SSR Crash in Next.js
**What goes wrong:** Importing @xterm/xterm at the top of a file causes "document is not defined" during SSR
**Why it happens:** xterm.js accesses browser DOM APIs at import time
**How to avoid:** Use dynamic import inside useEffect, or use next/dynamic with ssr: false for the terminal component
**Warning signs:** Build error mentioning "document" or "window" not defined

### Pitfall 2: Binary Data Handling on WebSocket
**What goes wrong:** Terminal output appears garbled or UTF-8 characters break
**Why it happens:** Default WebSocket message type is text (UTF-8). SSH stream outputs raw bytes that may not be valid UTF-8.
**How to avoid:** Set `ws.binaryType = "arraybuffer"` on client side. Send Buffer data from server. Use `terminal.write(new Uint8Array(data))` not `terminal.write(string)`.
**Warning signs:** Garbled output, broken box-drawing characters, corrupt colored output

### Pitfall 3: Terminal Resize Not Propagating
**What goes wrong:** Terminal wraps incorrectly, columns don't match window size
**Why it happens:** Terminal cols/rows must be synchronized between xterm.js, WebSocket, and the SSH PTY
**How to avoid:** Send resize events from xterm.js `onResize` callback through WebSocket. On server, call `stream.setWindow(rows, cols, 0, 0)` on the SSH channel. Call `fitAddon.fit()` on initial open AND on container resize.
**Warning signs:** Wrapped lines mid-word, vim/nano display broken, ls columns wrong

### Pitfall 4: SSH Connection to Localhost Requires Auth
**What goes wrong:** ssh2 connection to 127.0.0.1 fails with "authentication failed"
**Why it happens:** Even on localhost, SSH requires authentication. The VPS proxy needs credentials.
**How to avoid:** Use either password auth (SSH_PASSWORD env var) or key-based auth (read /root/.ssh/id_rsa). Password is simpler for single-VPS setup. Ensure sshd is running and allows the auth method.
**Warning signs:** "All configured authentication methods failed" error from ssh2

### Pitfall 5: OpenClaw Gateway Not Responding
**What goes wrong:** Real agent chat/task calls return connection refused or timeout
**Why it happens:** OpenClaw gateway HTTP API is disabled by default. Port 18789 is WebSocket only unless HTTP is explicitly enabled.
**How to avoid:** Run `openclaw config set api.http.enabled true` on VPS. Verify with `curl http://127.0.0.1:18789/api/status`. The gateway exposes both WS and HTTP on the same port.
**Warning signs:** ECONNREFUSED on port 18789, or 404 on HTTP endpoints

### Pitfall 6: In-Memory State Lost on Proxy Restart
**What goes wrong:** Deployment state disappears after proxy restart, in-progress deployments become orphaned
**Why it happens:** Current api-routes.ts uses `Map<string, DeploymentState>()` which lives only in process memory
**How to avoid:** Persist deployment state to JSON files in /data/state/ directory. Load on startup, write on every state change.
**Warning signs:** Deployments stuck in "in_progress" forever after proxy restart

### Pitfall 7: xterm.js CSS Not Loading
**What goes wrong:** Terminal renders but text is invisible or layout is broken
**Why it happens:** xterm.js requires its CSS file to be imported. With dynamic imports, the CSS import may not execute.
**How to avoid:** Import `@xterm/xterm/css/xterm.css` alongside the Terminal constructor. In Next.js, may need to add to global CSS or use a CSS import in the component.
**Warning signs:** Terminal div has correct DOM structure but nothing visible

## Code Examples

### OpenClaw Gateway Health Check (from VPS proxy)
```typescript
// Replace stub in api-routes.ts GET /api/health
const OPENCLAW_URL = process.env.OPENCLAW_HTTP_URL || "http://127.0.0.1:18789";
const AUTH_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || "";

async function checkOpenClawGateway(): Promise<{ status: string; sessions: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${OPENCLAW_URL}/api/status`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { status: "error", sessions: 0 };
    return await res.json();
  } catch {
    clearTimeout(timeout);
    return { status: "unreachable", sessions: 0 };
  }
}
```

### Docker Container Count for Health Endpoint
```typescript
// For agentCount in GET /api/health response
import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function countRunningAgents(): Promise<number> {
  const containers = await docker.listContainers({
    filters: { status: ['running'], label: ['agency-factory=true'] },
  });
  return containers.length;
}
```

### Terminal WebSocket Path Registration
```typescript
// Addition to parseWsPath() in api-server.ts
const termMatch = pathname.match(/^\/ws\/terminal\/(.+)$/);
if (termMatch) {
  return { type: "terminal", businessSlug: termMatch[1] };
}
```

### Tenant Stop/Resume Endpoints
```typescript
// POST /api/tenants/stop
router.post("/api/tenants/stop", async (req, res) => {
  const { businessSlug } = req.body;
  const stoppedCount = await stopTenantContainers(businessSlug);
  res.json({ success: true, stoppedCount });
});

// POST /api/tenants/resume
router.post("/api/tenants/resume", async (req, res) => {
  const { businessSlug } = req.body;
  const resumedCount = await resumeTenantContainers(businessSlug);
  res.json({ success: true, resumedCount });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| xterm (unscoped) | @xterm/xterm (scoped) | 2024 | All addons also scoped: @xterm/addon-fit, @xterm/addon-web-links |
| xterm-addon-attach | Manual WebSocket handling | Current best practice | addon-attach too simple for SSH binary data + resize events |
| socket.io for terminal | Raw WebSocket (ws library) | Current preference | Less overhead, already used in VPS proxy, no extra dependency |
| OpenClaw WS-only gateway | OpenClaw HTTP + WS multiplex | 2025-2026 | REST endpoints (/api/sessions/:key/messages) alongside WebSocket |

**Deprecated/outdated:**
- `xterm` (unscoped package): Use `@xterm/xterm` instead
- `xterm-addon-fit`: Use `@xterm/addon-fit` instead
- `xterm-addon-web-links`: Use `@xterm/addon-web-links` instead

## Open Questions

1. **SSH Auth Method on Hostinger VPS**
   - What we know: ssh2 supports password, publicKey, and agent-based auth
   - What's unclear: Which method is available/preferred on the Hostinger VPS
   - Recommendation: Support both password (SSH_PASSWORD env var) and key-based (SSH_PRIVATE_KEY_PATH env var). Default to password for simplicity in single-VPS setup.

2. **OpenClaw Agent Session Key Convention**
   - What we know: OpenClaw uses session keys like "main" or custom keys for routing messages to agents
   - What's unclear: How multi-agent sessions are keyed -- whether vpsAgentId maps directly to session key
   - Recommendation: Use `{vpsAgentId}` as the session key in `/api/sessions/{vpsAgentId}/messages`. Verify during manual setup.

3. **xterm.js CSS in Next.js with Tailwind v4**
   - What we know: xterm.js requires its CSS for correct rendering
   - What's unclear: Whether dynamic CSS import works cleanly with Tailwind v4's CSS-only config approach
   - Recommendation: Import xterm.css via a `<link>` tag in the terminal page's head, or import it in the component with dynamic import. Test during implementation.

4. **Docker Socket Access from Express Process**
   - What we know: dockerode connects to /var/run/docker.sock by default
   - What's unclear: Whether the systemd service user has Docker socket permissions
   - Recommendation: Ensure the proxy runs as root or a user in the docker group. The setup.sh script already runs as root.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `infra/vps/api-server.ts`, `api-routes.ts`, `api-types.ts` -- existing VPS proxy with 13 TODO markers
- Codebase analysis: `packages/core/vps/` -- 9 files with VPS client, health, deploy, chat, task, lifecycle services
- Codebase analysis: `apps/web/_components/` -- health-dashboard.tsx, vps-status-indicator.tsx, deployment-progress-stream.tsx
- npm: @xterm/xterm 6.0.0, @xterm/addon-fit 0.11.0, @xterm/addon-web-links 0.12.0

### Secondary (MEDIUM confidence)
- OpenClaw Gateway docs (docs.openclaw.ai) -- REST endpoints: GET /api/status, POST /api/sessions/:key/messages, POST /v1/chat/completions
- npm: ssh2 1.16.0 (mscdex/ssh2) -- pure JS SSH2 client, no native deps
- npm: dockerode 4.0.9 -- Docker Remote API client for Node.js
- WebSSH2 project (github.com/billchurch/webssh2) -- reference implementation for xterm.js + ssh2 + WebSocket

### Tertiary (LOW confidence)
- OpenClaw multi-agent session key convention -- inferred from docs, needs validation during setup

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- xterm.js, ssh2, dockerode are well-established libraries with current npm versions verified
- Architecture: HIGH -- pattern is well-known (browser xterm.js -> WS -> ssh2 -> SSH), codebase already has extensive scaffolding
- VPS activation (stub replacement): MEDIUM -- OpenClaw gateway API endpoints verified via docs, but exact multi-agent routing needs manual validation
- Pitfalls: HIGH -- common issues well-documented across community, verified against codebase patterns

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries, architecture unlikely to change)
