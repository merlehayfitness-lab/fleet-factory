// CRM domain types for Twenty CRM integration.
// All interfaces reflect the canonical shape used throughout the application.

export interface CrmContact {
  id: string;
  businessId: string;
  externalId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  source: "inbound" | "outbound" | "referral" | "organic";
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  score?: number;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDeal {
  id: string;
  businessId: string;
  contactId: string;
  title: string;
  value: number;
  currency: string;
  stage:
    | "lead"
    | "qualified"
    | "proposal"
    | "negotiation"
    | "closed_won"
    | "closed_lost";
  probability: number;
  expectedCloseDate?: string;
  assignedAgentId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CrmActivity {
  id: string;
  businessId: string;
  contactId?: string;
  dealId?: string;
  agentId?: string;
  type:
    | "email_sent"
    | "email_received"
    | "call"
    | "meeting"
    | "note"
    | "task"
    | "deal_update";
  subject: string;
  description?: string;
  createdAt: string;
}

export interface CrmPipelineSummary {
  totalDeals: number;
  totalValue: number;
  byStage: Record<string, { count: number; value: number }>;
  wonThisMonth: number;
  lostThisMonth: number;
  conversionRate: number;
}

export interface TwentyCrmConfig {
  baseUrl: string;
  apiKey: string;
  workspaceId?: string;
}
