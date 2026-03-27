"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AgentOverview } from "@/_components/agent-overview";
import { AgentConfig } from "@/_components/agent-config";
import { AgentActivity } from "@/_components/agent-activity";
import { AgentConversations } from "@/_components/agent-conversations";
import { AgentIntegrations } from "@/_components/agent-integrations";
import { AgentKnowledgeTab } from "@/_components/agent-knowledge-tab";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
}

interface Agent {
  id: string;
  name: string;
  status: string;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  departments: { id: string; name: string; type: string } | null;
  agent_templates: Template | null;
}

interface Integration {
  id: string;
  business_id: string;
  agent_id: string;
  type: string;
  provider: string;
  config: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AgentDetailTabsProps {
  agent: Agent;
  auditLogs: AuditLog[];
  businessId: string;
  integrations: Integration[];
}

/**
 * Client-side 6-tab layout for the agent detail page.
 *
 * Tabs: Overview, Config, Activity, Conversations, Integrations, Knowledge.
 * Uses client-side state only (no URL changes) to prevent full page reloads.
 */
export function AgentDetailTabs({
  agent,
  auditLogs,
  businessId,
  integrations,
}: AgentDetailTabsProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="config">Config</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="conversations">Conversations</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <AgentOverview agent={agent} businessId={businessId} />
      </TabsContent>

      <TabsContent value="config">
        <AgentConfig
          agent={agent}
          template={agent.agent_templates}
          businessId={businessId}
        />
      </TabsContent>

      <TabsContent value="activity">
        <AgentActivity auditLogs={auditLogs} />
      </TabsContent>

      <TabsContent value="conversations">
        <AgentConversations />
      </TabsContent>

      <TabsContent value="integrations">
        <AgentIntegrations
          agentId={agent.id}
          businessId={businessId}
          integrations={integrations}
        />
      </TabsContent>

      <TabsContent value="knowledge">
        <AgentKnowledgeTab
          businessId={businessId}
          agentId={agent.id}
          agentName={agent.name}
        />
      </TabsContent>
    </Tabs>
  );
}
