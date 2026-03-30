"use client";

import { useEffect, useRef, useState } from "react";

interface EmbeddedTerminalProps {
  wsUrl: string;
}

/**
 * Client Component with xterm.js terminal emulator and WebSocket connection.
 *
 * Dynamically imports @xterm/xterm to avoid SSR issues.
 * Connects to VPS terminal bridge via WebSocket with binary data.
 * Supports resize events and exponential backoff reconnection.
 */
export function EmbeddedTerminal({ wsUrl }: EmbeddedTerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    let terminal: any;
    let fitAddon: any;
    let resizeObserver: ResizeObserver | undefined;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");
      // @ts-expect-error -- CSS module import handled by bundler at runtime
      await import("@xterm/xterm/css/xterm.css");

      terminal = new Terminal({
        cursorBlink: true,
        theme: {
          background: "#1a1a2e",
          foreground: "#e0e0e0",
          cursor: "#00ff41",
          selectionBackground: "#3a3a5e",
        },
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: 14,
        scrollback: 5000,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      if (!termRef.current) return;
      terminal.open(termRef.current);
      fitAddon.fit();

      connectWebSocket(terminal, fitAddon);

      resizeObserver = new ResizeObserver(() => {
        if (fitAddon) fitAddon.fit();
      });
      resizeObserver.observe(termRef.current);
    }

    function connectWebSocket(term: any, fit: any) {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttemptRef.current = 0;
        // Send initial terminal dimensions
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          }),
        );
      };

      ws.onmessage = (e) => {
        term.write(new Uint8Array(e.data));
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect with exponential backoff: 1s, 2s, 4s, 8s max
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptRef.current),
          8000,
        );
        term.write(
          `\r\n\x1b[33mDisconnected. Reconnecting in ${delay / 1000}s...\x1b[0m\r\n`,
        );
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptRef.current++;
          connectWebSocket(term, fit);
        }, delay);
      };

      ws.onerror = () => {
        // onclose handles reconnect
      };

      // Terminal input -> WebSocket
      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      });

      // Terminal resize -> WebSocket
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });
    }

    init();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      resizeObserver?.disconnect();
      terminal?.dispose();
    };
  }, [wsUrl]);

  return (
    <div className="relative h-full w-full">
      {!connected && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1a1a2e]/80">
          <div className="text-sm text-gray-400">Connecting to VPS...</div>
        </div>
      )}
      <div ref={termRef} className="h-full w-full" />
    </div>
  );
}
