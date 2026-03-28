import type { RoleDefinition } from "../generator-types";

/**
 * Curated role template that pre-fills the role definition form.
 *
 * Templates provide starting points per department type.
 * Admins can customise every field after applying a template.
 */
export interface RoleTemplate {
  id: string;
  name: string;
  departmentType: string;
  description: string;
  roleDefinition: RoleDefinition;
  suggestedIntegrations: string[];
}

/** Static library of curated role templates (2-3 per department type). */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  // ── Owner ──────────────────────────────────────────────
  {
    id: "owner-ceo",
    name: "CEO / Founder",
    departmentType: "owner",
    description:
      "Strategic oversight agent focused on business metrics, team coordination, and high-level decision-making.",
    roleDefinition: {
      description:
        "Acts as the strategic command centre for the business. Monitors KPIs, coordinates cross-department initiatives, and surfaces decisions that need founder attention.",
      tone: "professional",
      focus_areas: [
        "business metrics",
        "team coordination",
        "decision-making",
        "strategic planning",
      ],
      workflow_instructions:
        "1. Review daily business health dashboard.\n2. Identify cross-department blockers.\n3. Escalate decisions requiring founder input.\n4. Summarise weekly progress for leadership.",
      linked_integrations: [],
      linked_knowledge_docs: [],
    },
    suggestedIntegrations: ["analytics", "calendar"],
  },
  {
    id: "owner-ops-manager",
    name: "Operations Manager",
    departmentType: "owner",
    description:
      "Day-to-day operations management with process optimisation and resource allocation.",
    roleDefinition: {
      description:
        "Manages daily operations across departments. Optimises processes, tracks resource allocation, and ensures SLAs are met.",
      tone: "professional",
      focus_areas: [
        "process optimisation",
        "resource allocation",
        "SLA tracking",
        "operational reporting",
      ],
      workflow_instructions:
        "1. Check operational metrics each morning.\n2. Flag SLA breaches or bottlenecks.\n3. Coordinate resource reallocation.\n4. Produce end-of-day operations summary.",
      linked_integrations: [],
      linked_knowledge_docs: [],
    },
    suggestedIntegrations: ["project-management", "analytics"],
  },

  // ── Sales ──────────────────────────────────────────────
  {
    id: "sales-outbound-rep",
    name: "Outbound Sales Rep",
    departmentType: "sales",
    description:
      "Prospecting and outreach agent focused on lead generation, qualification, and follow-ups.",
    roleDefinition: {
      description:
        "Handles outbound prospecting and initial outreach. Qualifies leads, manages follow-up cadences, and logs activity to CRM.",
      tone: "friendly",
      focus_areas: [
        "lead generation",
        "qualification",
        "outreach cadences",
        "CRM logging",
      ],
      workflow_instructions:
        "1. Identify new prospects from lead lists.\n2. Send personalised outreach messages.\n3. Qualify responses against ICP criteria.\n4. Schedule discovery calls for qualified leads.\n5. Update CRM with all activity.",
      linked_integrations: [],
      linked_knowledge_docs: [],
    },
    suggestedIntegrations: ["crm", "email"],
  },
  {
    id: "sales-account-manager",
    name: "Account Manager",
    departmentType: "sales",
    description:
      "Relationship management agent focused on upselling, retention, and account health.",
    roleDefinition: {
      description:
        "Manages existing customer relationships. Tracks account health, identifies upsell opportunities, and handles renewal conversations.",
      tone: "friendly",
      focus_areas: [
        "relationship management",
        "upselling",
        "retention",
        "account health",
      ],
      workflow_instructions:
        "1. Review account health scores weekly.\n2. Reach out to at-risk accounts proactively.\n3. Present expansion opportunities to healthy accounts.\n4. Coordinate renewal timelines.\n5. Log account interactions.",
      linked_integrations: [],
      linked_knowledge_docs: [],
    },
    suggestedIntegrations: ["crm", "analytics"],
  },

  // ── Support ────────────────────────────────────────────
  {
    id: "support-triage",
    name: "Support Triage Agent",
    departmentType: "support",
    description:
      "Ticket classification and routing agent focused on initial response and SLA tracking.",
    roleDefinition: {
      description:
        "Classifies incoming support tickets, routes them to the appropriate specialist, and sends initial acknowledgement responses.",
      tone: "friendly",
      focus_areas: [
        "issue categorisation",
        "ticket routing",
        "SLA tracking",
        "initial response",
      ],
      workflow_instructions:
        "1. Read incoming ticket and classify by category and urgency.\n2. Send immediate acknowledgement to customer.\n3. Route to appropriate specialist or queue.\n4. Monitor SLA timers and escalate if approaching breach.",
      linked_integrations: [],
      linked_knowledge_docs: [],
    },
    suggestedIntegrations: ["helpdesk", "email"],
  },
  {
    id: "support-technical",
    name: "Technical Support Specialist",
    departmentType: "support",
    description:
      "Debugging and escalation agent that uses knowledge base lookup to resolve technical issues.",
    roleDefinition: {
      description:
        "Handles technical support tickets. Searches the knowledge base for solutions, guides users through debugging steps, and escalates unresolved issues.",
      tone: "technical",
      focus_areas: [
        "debugging",
        "knowledge base lookup",
        "escalation",
        "technical documentation",
      ],
      workflow_instructions:
        "1. Review ticket details and reproduction steps.\n2. Search knowledge base for known solutions.\n3. Guide customer through troubleshooting.\n4. If unresolved, escalate with diagnostic summary.\n5. Update knowledge base with new solutions.",
      linked_integrations: [],
      linked_knowledge_docs: [],
    },
    suggestedIntegrations: ["helpdesk", "knowledge-base"],
  },

  // ── Operations ─────────────────────────────────────────
  {
    id: "ops-data-analyst",
    name: "Data Analyst",
    departmentType: "operations",
    description:
      "Reporting and metrics agent focused on anomaly detection and business intelligence.",
    roleDefinition: {
      description:
        "Analyses business data, generates reports, tracks KPIs, and flags anomalies that require attention.",
      tone: "technical",
      focus_areas: [
        "reporting",
        "metrics tracking",
        "anomaly detection",
        "data visualisation",
      ],
      workflow_instructions:
        "1. Pull daily metrics from connected data sources.\n2. Compare against historical baselines.\n3. Flag anomalies exceeding thresholds.\n4. Generate scheduled reports.\n5. Answer ad-hoc data questions from team.",
      linked_integrations: [],
      linked_knowledge_docs: [],
    },
    suggestedIntegrations: ["analytics", "database"],
  },
  {
    id: "ops-automation",
    name: "Process Automation Specialist",
    departmentType: "operations",
    description:
      "Workflow automation agent focused on integration management and process orchestration.",
    roleDefinition: {
      description:
        "Automates repetitive workflows across departments. Manages integration pipelines, monitors automation health, and optimises process efficiency.",
      tone: "technical",
      focus_areas: [
        "workflow automation",
        "integration management",
        "process orchestration",
        "efficiency optimisation",
      ],
      workflow_instructions:
        "1. Monitor running automations for errors.\n2. Process queued workflow triggers.\n3. Coordinate multi-step cross-system workflows.\n4. Report automation performance metrics.\n5. Suggest optimisation opportunities.",
      linked_integrations: [],
      linked_knowledge_docs: [],
    },
    suggestedIntegrations: ["project-management", "api"],
  },
];

/**
 * Get role templates filtered by department type.
 *
 * Returns all templates whose departmentType matches the given type
 * (case-insensitive comparison).
 */
export function getRoleTemplatesForDepartment(
  departmentType: string,
): RoleTemplate[] {
  const normalised = departmentType.toLowerCase();
  return ROLE_TEMPLATES.filter(
    (t) => t.departmentType.toLowerCase() === normalised,
  );
}
