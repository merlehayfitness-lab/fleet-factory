"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CatalogSearchResult } from "@fleet-factory/core";

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

export interface McpConfigEntry {
  name: string;
  enabled: boolean;
  isUniversal: boolean;
  isCustom?: boolean;
  npmPackage?: string;
  description?: string;
}

/** Default universal MCPs — always enabled, cannot be toggled off */
const UNIVERSAL_MCPS: McpConfigEntry[] = [
  { name: "filesystem", enabled: true, isUniversal: true, description: "Local filesystem access" },
  { name: "memory", enabled: true, isUniversal: true, description: "Persistent memory / knowledge graph" },
  { name: "brave-search", enabled: true, isUniversal: true, description: "Web search via Brave" },
  { name: "fetch", enabled: true, isUniversal: true, description: "HTTP fetch for web content" },
  { name: "slack", enabled: true, isUniversal: true, description: "Slack messaging" },
];

/** Available optional MCPs from the registry */
const AVAILABLE_MCPS: McpConfigEntry[] = [
  { name: "supabase", enabled: false, isUniversal: false, description: "Supabase database access" },
  { name: "google-analytics", enabled: false, isUniversal: false, description: "Google Analytics data" },
  { name: "cms", enabled: false, isUniversal: false, description: "Content management system" },
  { name: "email", enabled: false, isUniversal: false, description: "Email sending and management" },
  { name: "crm", enabled: false, isUniversal: false, description: "CRM data access" },
  { name: "social-api", enabled: false, isUniversal: false, description: "Social media platform APIs" },
  { name: "project-mgmt", enabled: false, isUniversal: false, description: "Project management tools" },
  { name: "calendar", enabled: false, isUniversal: false, description: "Calendar management" },
  { name: "helpdesk", enabled: false, isUniversal: false, description: "Helpdesk / ticket system" },
  { name: "knowledge-base", enabled: false, isUniversal: false, description: "Knowledge base search" },
  { name: "docs", enabled: false, isUniversal: false, description: "Document generation" },
  { name: "sequential-thinking", enabled: false, isUniversal: false, description: "Structured reasoning" },
  { name: "github", enabled: false, isUniversal: false, description: "GitHub repos, issues, PRs" },
  { name: "puppeteer", enabled: false, isUniversal: false, description: "Browser automation" },
  { name: "postgres", enabled: false, isUniversal: false, description: "PostgreSQL queries" },
];

export function getDefaultMcpConfig(): McpConfigEntry[] {
  return [...UNIVERSAL_MCPS.map((m) => ({ ...m })), ...AVAILABLE_MCPS.map((m) => ({ ...m }))];
}

interface WizardVpsStepProps {
  vpsConfig: VpsConfigInput;
  onVpsConfigChange: (v: VpsConfigInput) => void;
  mcpConfig: McpConfigEntry[];
  onMcpConfigChange: (entries: McpConfigEntry[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardVpsStep({
  vpsConfig,
  onVpsConfigChange,
  mcpConfig,
  onMcpConfigChange,
}: WizardVpsStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [mcpExpanded, setMcpExpanded] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPackage, setCustomPackage] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogResults, setCatalogResults] = useState<CatalogSearchResult[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  function update(field: keyof VpsConfigInput, value: string) {
    onVpsConfigChange({ ...vpsConfig, [field]: value });
    setTestResult(null);
  }

  function toggleMcp(name: string) {
    onMcpConfigChange(
      mcpConfig.map((m) =>
        m.name === name && !m.isUniversal ? { ...m, enabled: !m.enabled } : m,
      ),
    );
  }

  function addCustomMcp() {
    const trimName = customName.trim().toLowerCase().replace(/\s+/g, "-");
    const trimPkg = customPackage.trim();
    if (!trimName || !trimPkg) return;
    if (mcpConfig.some((m) => m.name === trimName)) return;
    onMcpConfigChange([
      ...mcpConfig,
      {
        name: trimName,
        enabled: true,
        isUniversal: false,
        isCustom: true,
        npmPackage: trimPkg,
        description: "Custom MCP server",
      },
    ]);
    setCustomName("");
    setCustomPackage("");
  }

  function removeCustomMcp(name: string) {
    onMcpConfigChange(mcpConfig.filter((m) => m.name !== name));
  }

  async function browseCatalog() {
    if (catalogResults) {
      setCatalogOpen((v) => !v);
      return;
    }
    setCatalogOpen(true);
    setCatalogLoading(true);
    try {
      const { searchAitmplAction } = await import("@/_actions/aitmpl-actions");
      const res = await searchAitmplAction("", { type: "mcp", limit: 30, sort: "downloads" });
      if ("error" in res) {
        setCatalogResults([]);
      } else {
        setCatalogResults(res.results);
      }
    } catch {
      setCatalogResults([]);
    } finally {
      setCatalogLoading(false);
    }
  }

  function addFromCatalog(item: CatalogSearchResult) {
    if (mcpConfig.some((m) => m.name === item.name)) return;
    onMcpConfigChange([
      ...mcpConfig,
      {
        name: item.name,
        enabled: true,
        isUniversal: false,
        isCustom: false,
        description: item.description,
      },
    ]);
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
  const universalMcps = mcpConfig.filter((m) => m.isUniversal);
  const availableMcps = mcpConfig.filter((m) => !m.isUniversal && !m.isCustom);
  const customMcps = mcpConfig.filter((m) => m.isCustom);
  const enabledCount = mcpConfig.filter((m) => m.enabled).length;

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

      {/* ----------------------------------------------------------------- */}
      {/* MCP Servers Section                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="border-t pt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setMcpExpanded((v) => !v)}
        >
          <div>
            <h3 className="text-sm font-medium">MCP Servers</h3>
            <p className="text-xs text-muted-foreground">
              {enabledCount} server{enabledCount !== 1 ? "s" : ""} enabled
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {mcpExpanded ? "▼" : "▶"}
          </span>
        </button>

        {mcpExpanded && (
          <div className="mt-3 space-y-4">
            {/* Universal MCPs */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Universal (always on)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {universalMcps.map((m) => (
                  <Badge key={m.name} variant="default" className="text-xs cursor-default">
                    {m.name}
                  </Badge>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Inherited by all agents via CEO workspace.
              </p>
            </div>

            {/* Available MCPs */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Available
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableMcps.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => toggleMcp(m.name)}
                    title={m.description}
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                      m.enabled
                        ? "bg-primary/10 text-primary ring-primary/20"
                        : "bg-muted text-muted-foreground ring-border hover:bg-muted/80"
                    }`}
                  >
                    {m.enabled ? "✓ " : ""}{m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom MCPs */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Custom
              </p>
              {customMcps.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {customMcps.map((m) => (
                    <span
                      key={m.name}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
                    >
                      {m.name}
                      <button
                        type="button"
                        onClick={() => removeCustomMcp(m.name)}
                        className="ml-0.5 text-primary/60 hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Server name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="npm package (e.g. @org/mcp-server-x)"
                  value={customPackage}
                  onChange={(e) => setCustomPackage(e.target.value)}
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={addCustomMcp}
                  disabled={!customName.trim() || !customPackage.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* AITMPL Catalog Browser */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                AITMPL Catalog
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={browseCatalog}
                disabled={catalogLoading}
              >
                {catalogLoading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                {catalogOpen && catalogResults ? "Hide" : "Browse"} AITMPL MCPs
              </Button>

              {catalogOpen && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border p-2">
                  {catalogLoading && (
                    <p className="py-4 text-center text-xs text-muted-foreground">Loading catalog...</p>
                  )}
                  {!catalogLoading && catalogResults && catalogResults.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">No MCP servers found in catalog.</p>
                  )}
                  {!catalogLoading && catalogResults && catalogResults.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {catalogResults.map((item) => {
                        const isAdded = mcpConfig.some((m) => m.name === item.name);
                        return (
                          <div
                            key={item.path}
                            className="flex items-start justify-between rounded-md border p-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{item.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.description}
                              </p>
                              {item.downloads > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {item.downloads.toLocaleString()} downloads
                                </span>
                              )}
                            </div>
                            {isAdded ? (
                              <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                                Added
                              </Badge>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="ml-2 h-6 shrink-0 px-2 text-[10px]"
                                onClick={() => addFromCatalog(item)}
                              >
                                + Add
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
