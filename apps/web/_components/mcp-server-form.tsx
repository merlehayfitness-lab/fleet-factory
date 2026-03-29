"use client";

import { useState } from "react";
import type { McpServerConfig } from "@agency-factory/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Wifi, WifiOff } from "lucide-react";

interface McpServerFormProps {
  server: McpServerConfig;
  onChange: (updated: McpServerConfig) => void;
  onRemove: () => void;
  onTest?: () => Promise<{ reachable: boolean; error?: string }>;
}

/**
 * Form for configuring a single MCP server.
 * Shows name, url/command, transport, env vars, test, and remove.
 */
export function McpServerForm({
  server,
  onChange,
  onRemove,
  onTest,
}: McpServerFormProps) {
  const [testResult, setTestResult] = useState<{
    reachable: boolean;
    error?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const envEntries = Object.entries(server.env ?? {});
  const isRemoteTransport = server.transport === "http" || server.transport === "sse";
  const urlLabel = server.transport === "stdio" ? "Command" : "URL";

  function updateField(field: Partial<McpServerConfig>) {
    onChange({ ...server, ...field });
  }

  function updateEnv(key: string, value: string, oldKey?: string) {
    const env = { ...(server.env ?? {}) };
    if (oldKey && oldKey !== key) delete env[oldKey];
    env[key] = value;
    updateField({ env });
  }

  function removeEnvVar(key: string) {
    const env = { ...(server.env ?? {}) };
    delete env[key];
    updateField({ env });
  }

  function addEnvVar() {
    const env = { ...(server.env ?? {}), "": "" };
    updateField({ env });
  }

  async function handleTest() {
    if (!onTest) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch {
      setTestResult({ reachable: false, error: "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={server.name}
              onChange={(e) => updateField({ name: e.target.value })}
              placeholder="Server name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Transport</Label>
            <Select
              value={server.transport}
              onValueChange={(val: string | null) => {
                if (val) updateField({ transport: val as McpServerConfig["transport"] });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">stdio</SelectItem>
                <SelectItem value="http">http</SelectItem>
                <SelectItem value="sse">sse</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{urlLabel}</Label>
          <Input
            value={server.url}
            onChange={(e) => updateField({ url: e.target.value })}
            placeholder={server.transport === "stdio" ? "npx -y @mcp/server" : "https://..."}
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={server.enabled}
            onChange={(e) => updateField({ enabled: e.target.checked })}
          />
          Enabled
        </label>

        {/* Environment Variables */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Environment Variables
          </p>
          {envEntries.map(([key, val], i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="flex-1 text-xs"
                placeholder="KEY"
                value={key}
                onChange={(e) => updateEnv(e.target.value, val, key)}
              />
              <Input
                className="flex-1 text-xs"
                placeholder="value"
                value={val}
                onChange={(e) => updateEnv(key, e.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => removeEnvVar(key)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addEnvVar} className="text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add Variable
          </Button>
        </div>

        {/* Footer: Test + Remove */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            {isRemoteTransport && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !server.url}
              >
                {testing ? "Testing..." : "Test Connection"}
              </Button>
            )}
            {testResult && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  testResult.reachable ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {testResult.reachable ? (
                  <><Wifi className="h-3 w-3" /> Reachable</>
                ) : (
                  <><WifiOff className="h-3 w-3" /> {testResult.error ?? "Unreachable"}</>
                )}
              </span>
            )}
          </div>
          {confirmRemove ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Remove?</span>
              <Button variant="destructive" size="sm" onClick={onRemove}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-1 h-3 w-3" /> Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
