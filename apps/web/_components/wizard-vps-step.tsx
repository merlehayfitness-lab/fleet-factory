"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VpsConfigInput {
  host: string;
  sshUser: string;
  sshPassword: string;
  proxyApiKey: string;
  sshPort: string;
  proxyPort: string;
}

export const defaultVpsConfig: VpsConfigInput = {
  host: "",
  sshUser: "root",
  sshPassword: "",
  proxyApiKey: "",
  sshPort: "22",
  proxyPort: "3100",
};

interface WizardVpsStepProps {
  vpsConfig: VpsConfigInput;
  onVpsConfigChange: (v: VpsConfigInput) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardVpsStep({ vpsConfig, onVpsConfigChange }: WizardVpsStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function update(field: keyof VpsConfigInput, value: string) {
    onVpsConfigChange({ ...vpsConfig, [field]: value });
    setTestResult(null);
  }

  async function testConnection() {
    if (!vpsConfig.host) {
      setTestResult({ ok: false, message: "Host is required" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { testVpsSshConnection } = await import("@/_actions/business-actions");
      const result = await testVpsSshConnection({
        host: vpsConfig.host,
        sshUser: vpsConfig.sshUser || "root",
        sshPassword: vpsConfig.sshPassword,
        sshPort: Number(vpsConfig.sshPort) || 22,
      });
      setTestResult({ ok: result.ok, message: result.message });
    } catch {
      setTestResult({ ok: false, message: "Test failed — could not reach server" });
    } finally {
      setTesting(false);
    }
  }

  const isSkipped = !vpsConfig.host;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Configure this business&apos;s VPS deployment target. Each business can deploy to its own
        server. If left blank, the platform&apos;s default VPS will be used.
      </p>

      {/* Host */}
      <div className="space-y-2">
        <Label htmlFor="vps-host">VPS Host / IP</Label>
        <Input
          id="vps-host"
          placeholder="23.166.40.44"
          value={vpsConfig.host}
          onChange={(e) => update("host", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to use the platform default VPS.
        </p>
      </div>

      {/* SSH User */}
      <div className="space-y-2">
        <Label htmlFor="vps-ssh-user">SSH User</Label>
        <Input
          id="vps-ssh-user"
          placeholder="root"
          value={vpsConfig.sshUser}
          onChange={(e) => update("sshUser", e.target.value)}
          disabled={isSkipped}
        />
      </div>

      {/* SSH Password */}
      <div className="space-y-2">
        <Label htmlFor="vps-ssh-password">SSH Password</Label>
        <Input
          id="vps-ssh-password"
          type="password"
          placeholder="••••••••"
          value={vpsConfig.sshPassword}
          onChange={(e) => update("sshPassword", e.target.value)}
          disabled={isSkipped}
        />
        <p className="text-xs text-muted-foreground">Stored encrypted. Never shown again.</p>
      </div>

      {/* Proxy API Key */}
      <div className="space-y-2">
        <Label htmlFor="vps-proxy-api-key">Proxy API Key</Label>
        <Input
          id="vps-proxy-api-key"
          type="password"
          placeholder="••••••••"
          value={vpsConfig.proxyApiKey}
          onChange={(e) => update("proxyApiKey", e.target.value)}
          disabled={isSkipped}
        />
        <p className="text-xs text-muted-foreground">
          API key for the VPS proxy (used to authenticate agent API calls).
        </p>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? "Hide" : "Show"} advanced settings
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vps-ssh-port">SSH Port</Label>
            <Input
              id="vps-ssh-port"
              placeholder="22"
              value={vpsConfig.sshPort}
              onChange={(e) => update("sshPort", e.target.value)}
              disabled={isSkipped}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vps-proxy-port">Proxy Port</Label>
            <Input
              id="vps-proxy-port"
              placeholder="3100"
              value={vpsConfig.proxyPort}
              onChange={(e) => update("proxyPort", e.target.value)}
              disabled={isSkipped}
            />
          </div>
        </div>
      )}

      {/* Test connection */}
      {!isSkipped && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={testing || !vpsConfig.host}
          >
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          {testResult && (
            <span
              className={`text-xs font-medium ${testResult.ok ? "text-green-600" : "text-destructive"}`}
            >
              {testResult.ok ? "✓" : "✗"} {testResult.message}
            </span>
          )}
        </div>
      )}

      {isSkipped && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No VPS configured — will use platform default. You can add a dedicated VPS later in
          business settings.
        </div>
      )}
    </div>
  );
}
