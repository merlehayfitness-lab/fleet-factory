"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AgentOverview } from "@/_components/agent-overview";
import { AgentConfig } from "@/_components/agent-config";
import { AgentActivity } from "@/_components/agent-activity";
import { AgentConversations } from "@/_components/agent-conversations";
import { AgentIntegrations } from "@/_components/agent-integrations";
import { AgentSkillsTab } from "@/_components/agent-skills-tab";
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
  role: string | null;
  parent_agent_id: string | null;
  role_definition: Record<string, unknown> | null;
  skill_definition: string | null;
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

interface KnowledgeDoc {
  id: string;
  title: string;
}

interface IntegrationItem {
  id: string;
  name: string;
  type: string;
}

interface RelatedAgent {
  id: string;
  name: string;
  status: string;
  role: string | null;
}

interface Department {
  id: string;
  name: string;
  type: string;
}

interface AgentTarget {
  id: string;
  name: string;
  department_id: string;
}

interface AgentDetailTabsProps {
  agent: Agent;
  auditLogs: AuditLog[];
  businessId: string;
  integrations: Integration[];
  knowledgeDocs: KnowledgeDoc[];
  configIntegrations: IntegrationItem[];
  parentAgent?: RelatedAgent;
  childAgents?: RelatedAgent[];
  departments: Department[];
  allAgents: AgentTarget[];
}

/**
 * Client-side 7-tab layout for the agent detail page.
 *
 * Tabs: Overview, Config, Activity, Conversations, Integrations, Skills, Knowledge.
 * Uses client-side state only (no URL changes) to prevent full page reloads.
 */
export function AgentDetailTabs({
  agent,
  auditLogs,
  businessId,
  integrations,
  knowledgeDocs,
  configIntegrations,
  parentAgent,
  childAgents,
  departments,
  allAgents,
}: AgentDetailTabsProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="config">Config</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="conversations">Conversations</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <AgentOverview
          agent={agent}
          businessId={businessId}
          parentAgent={parentAgent}
          childAgents={childAgents}
        />
      </TabsContent>

      <TabsContent value="config">
        <AgentConfig
          agent={agent}
          template={agent.agent_templates}
          businessId={businessId}
          knowledgeDocs={knowledgeDocs}
          integrations={configIntegrations}
          departmentType={agent.departments?.type}
        />
      </TabsContent>

      <TabsContent value="activity">
        <AgentActivity auditLogs={auditLogs} />
      </TabsContent>

      <TabsContent value="conversations">
        <AgentConversations
          businessId={businessId}
          departmentId={agent.departments?.id ?? ""}
        />
      </TabsContent>

      <TabsContent value="integrations">
        <AgentIntegrations
          agentId={agent.id}
          businessId={businessId}
          integrations={integrations}
          departments={departments}
          agents={allAgents}
        />
      </TabsContent>

      <TabsContent value="skills">
        <AgentSkillsTab
          businessId={businessId}
          agentId={agent.id}
          departmentId={agent.departments?.id ?? ""}
          agentName={agent.name}
          departmentType={agent.departments?.type}
          agents={allAgents.map((a) => {
            const dept = departments.find((d) => d.id === a.department_id);
            return { id: a.id, name: a.name, department_name: dept?.name };
          })}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
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
