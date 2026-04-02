"use client";

import { useState } from "react";
import type {
  ToolProfileShape,
  McpServerConfig,
  KnownMcpServer,
} from "@fleet-factory/core";
import {
  KNOWN_MCP_SERVERS,
  DEPARTMENT_DEFAULT_TOOL_PROFILES,
} from "@fleet-factory/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus } from "lucide-react";
import { McpServerForm } from "./mcp-server-form";
import { testMcpConnectionAction } from "@/_actions/agent-actions";

interface ToolProfileFormProps {
  profile: ToolProfileShape;
  onChange: (updated: ToolProfileShape) => void;
  businessId: string;
}

// Collect all known tool names from department defaults for autocomplete
const ALL_KNOWN_TOOLS = Array.from(
  new Set(
    Object.values(DEPARTMENT_DEFAULT_TOOL_PROFILES).flatMap(
      (p) => p.allowed_tools,
    ),
  ),
).filter((t) => t !== "*");

/**
 * Structured form for editing a ToolProfileShape.
 * Shows allowed tools badges with add/remove, and MCP server list.
 */
export function ToolProfileForm({
  profile,
  onChange,
  businessId,
}: ToolProfileFormProps) {
  const [newTool, setNewTool] = useState("");
  const [showMcpPicker, setShowMcpPicker] = useState(false);

  const hasWildcard = profile.allowed_tools.includes("*");

  function addTool(toolName: string) {
    if (!toolName.trim() || profile.allowed_tools.includes(toolName.trim())) return;
    const updated = {
      ...profile,
      allowed_tools: [...profile.allowed_tools.filter((t) => t !== "*"), toolName.trim()],
    };
    onChange(updated);
    setNewTool("");
  }

  function removeTool(toolName: string) {
    const updated = {
      ...profile,
      allowed_tools: profile.allowed_tools.filter((t) => t !== toolName),
    };
    // If removing last tool, add wildcard back
    if (updated.allowed_tools.length === 0) {
      updated.allowed_tools = ["*"];
    }
    onChange(updated);
  }

  function setAllTools() {
    onChange({ ...profile, allowed_tools: ["*"] });
  }

  function restrictTools() {
    onChange({ ...profile, allowed_tools: [] });
  }

  function updateMcpServer(index: number, updated: McpServerConfig) {
    const servers = [...profile.mcp_servers];
    servers[index] = updated;
    onChange({ ...profile, mcp_servers: servers });
  }

  function removeMcpServer(index: number) {
    const servers = profile.mcp_servers.filter((_, i) => i !== index);
    onChange({ ...profile, mcp_servers: servers });
  }

  function addMcpServerFromCatalog(known: KnownMcpServer) {
    const env: Record<string, string> = {};
    for (const field of known.configFields) {
      env[field.key] = "";
    }
    const newServer: McpServerConfig = {
      name: known.name,
      url: known.defaultUrl,
      transport: known.transport,
      env,
      enabled: true,
    };
    onChange({
      ...profile,
      mcp_servers: [...profile.mcp_servers, newServer],
    });
    setShowMcpPicker(false);
  }

  function addCustomServer() {
    const newServer: McpServerConfig = {
      name: "Custom Server",
      url: "",
      transport: "http",
      env: {},
      enabled: true,
    };
    onChange({
      ...profile,
      mcp_servers: [...profile.mcp_servers, newServer],
    });
    setShowMcpPicker(false);
  }

  // Filter suggestions for tools not yet added
  const suggestions = ALL_KNOWN_TOOLS.filter(
    (t) =>
      !profile.allowed_tools.includes(t) &&
      t.toLowerCase().includes(newTool.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Allowed Tools */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Allowed Tools</h4>

        {hasWildcard ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                All tools allowed
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={restrictTools}
                className="text-xs"
              >
                Restrict to specific tools
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {profile.allowed_tools.map((tool) => (
                <Badge
                  key={tool}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {tool}
                  <button
                    onClick={() => removeTool(tool)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  placeholder="Tool name"
                  className="text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTool(newTool);
                    }
                  }}
                />
                {newTool && suggestions.length > 0 && (
                  <div className="absolute top-full z-10 mt-1 max-h-32 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                    {suggestions.slice(0, 8).map((s) => (
                      <button
                        key={s}
                        className="w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                        onClick={() => addTool(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addTool(newTool)}
                disabled={!newTool.trim()}
              >
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={setAllTools}
              className="text-xs text-muted-foreground"
            >
              Allow all tools
            </Button>
          </div>
        )}
      </div>

      {/* MCP Servers */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">MCP Servers</h4>

        {profile.mcp_servers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No MCP servers configured
          </p>
        ) : (
          <div className="space-y-3">
            {profile.mcp_servers.map((server, i) => (
              <McpServerForm
                key={`${server.name}-${i}`}
                server={server}
                onChange={(updated) => updateMcpServer(i, updated)}
                onRemove={() => removeMcpServer(i)}
                onTest={async () =>
                  testMcpConnectionAction(server.url, server.transport)
                }
              />
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMcpPicker(!showMcpPicker)}
        >
          <Plus className="mr-1 h-3 w-3" /> Add MCP Server
        </Button>

        {showMcpPicker && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Select MCP Server</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {KNOWN_MCP_SERVERS.map((known) => (
                <button
                  key={known.name}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-accent"
                  onClick={() => addMcpServerFromCatalog(known)}
                >
                  <div>
                    <p className="text-sm font-medium">{known.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {known.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {known.category}
                  </Badge>
                </button>
              ))}
              <button
                className="flex w-full items-center gap-2 rounded-md border-t px-3 py-2 text-left hover:bg-accent"
                onClick={addCustomServer}
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Custom Server</p>
                  <p className="text-xs text-muted-foreground">
                    Add a custom MCP server
                  </p>
                </div>
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
