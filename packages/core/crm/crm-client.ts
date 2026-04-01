// REST client for Twenty CRM API.
// Wraps all HTTP calls with auth headers and consistent error handling.
// Use createTwentyCrmClient() to get a configured instance.

import type {
  CrmContact,
  CrmDeal,
  CrmActivity,
  CrmPipelineSummary,
  TwentyCrmConfig,
} from "./crm-types";

// ---------------------------------------------------------------------------
// Internal HTTP helpers
// ---------------------------------------------------------------------------

interface TwentyApiError {
  message: string;
  code?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Twenty CRM API error: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as TwentyApiError;
      if (body.message) errMsg = `Twenty CRM API error: ${body.message}`;
    } catch {
      // Ignore JSON parse failure -- use status text
    }
    throw new Error(errMsg);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Client factory and interface
// ---------------------------------------------------------------------------

export interface TwentyCrmClient {
  // Contacts
  listContacts(params?: { limit?: number; cursor?: string }): Promise<{
    data: CrmContact[];
    nextCursor?: string;
  }>;
  getContact(externalId: string): Promise<CrmContact>;
  createContact(
    payload: Omit<CrmContact, "id" | "businessId" | "createdAt" | "updatedAt">,
  ): Promise<CrmContact>;
  updateContact(
    externalId: string,
    patch: Partial<Omit<CrmContact, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<CrmContact>;
  deleteContact(externalId: string): Promise<void>;

  // Deals
  listDeals(params?: { contactId?: string; limit?: number; cursor?: string }): Promise<{
    data: CrmDeal[];
    nextCursor?: string;
  }>;
  getDeal(externalId: string): Promise<CrmDeal>;
  createDeal(
    payload: Omit<CrmDeal, "id" | "businessId" | "createdAt" | "updatedAt">,
  ): Promise<CrmDeal>;
  updateDeal(
    externalId: string,
    patch: Partial<Omit<CrmDeal, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<CrmDeal>;

  // Pipeline
  getPipelineSummary(): Promise<CrmPipelineSummary>;

  // Activities
  listActivities(params?: {
    contactId?: string;
    dealId?: string;
    limit?: number;
  }): Promise<CrmActivity[]>;
  createActivity(
    payload: Omit<CrmActivity, "id" | "businessId" | "createdAt">,
  ): Promise<CrmActivity>;
}

/**
 * Create a configured Twenty CRM REST client.
 * All methods throw on non-2xx responses.
 */
export function createTwentyCrmClient(config: TwentyCrmConfig): TwentyCrmClient {
  const { baseUrl, apiKey, workspaceId } = config;

  const baseHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(workspaceId ? { "X-Twenty-Workspace-Id": workspaceId } : {}),
  };

  // ------------------------------------------------------------------
  // Low-level HTTP methods
  // ------------------------------------------------------------------

  async function get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: baseHeaders,
    });
    return handleResponse<T>(res);
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  }

  async function patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "PATCH",
      headers: baseHeaders,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  }

  async function del(path: string): Promise<void> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "DELETE",
      headers: baseHeaders,
    });
    if (!res.ok) {
      throw new Error(
        `Twenty CRM delete failed: ${res.status} ${res.statusText}`,
      );
    }
  }

  // ------------------------------------------------------------------
  // Contact operations
  // Twenty CRM REST paths: /people  (Twenty uses "people" for persons/contacts)
  // ------------------------------------------------------------------

  async function listContacts(params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ data: CrmContact[]; nextCursor?: string }> {
    const query: Record<string, string> = {};
    if (params?.limit) query.limit = String(params.limit);
    if (params?.cursor) query.cursor = params.cursor;

    const raw = await get<{
      data: { edges: Array<{ node: Record<string, unknown> }>; pageInfo?: { endCursor?: string } };
    }>("/people", query);

    const data = (raw.data.edges ?? []).map(mapToCrmContact);
    return {
      data,
      nextCursor: raw.data.pageInfo?.endCursor,
    };
  }

  async function getContact(externalId: string): Promise<CrmContact> {
    const raw = await get<{ data: Record<string, unknown> }>(`/people/${externalId}`);
    return mapToCrmContact({ node: raw.data });
  }

  async function createContact(
    payload: Omit<CrmContact, "id" | "businessId" | "createdAt" | "updatedAt">,
  ): Promise<CrmContact> {
    const body = toTwentyContact(payload);
    const raw = await post<{ data: Record<string, unknown> }>("/people", body);
    return mapToCrmContact({ node: raw.data });
  }

  async function updateContact(
    externalId: string,
    patch: Partial<Omit<CrmContact, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<CrmContact> {
    const body = toTwentyContact(patch);
    const raw = await patch_<{ data: Record<string, unknown> }>(
      `/people/${externalId}`,
      body,
    );
    return mapToCrmContact({ node: raw.data });
  }

  // Alias to avoid name collision with the `patch` helper
  async function patch_<T>(path: string, body: unknown): Promise<T> {
    return patch<T>(path, body);
  }

  async function deleteContact(externalId: string): Promise<void> {
    await del(`/people/${externalId}`);
  }

  // ------------------------------------------------------------------
  // Deal operations
  // Twenty CRM REST paths: /opportunities
  // ------------------------------------------------------------------

  async function listDeals(params?: {
    contactId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ data: CrmDeal[]; nextCursor?: string }> {
    const query: Record<string, string> = {};
    if (params?.limit) query.limit = String(params.limit);
    if (params?.cursor) query.cursor = params.cursor;
    if (params?.contactId) query.contactId = params.contactId;

    const raw = await get<{
      data: { edges: Array<{ node: Record<string, unknown> }>; pageInfo?: { endCursor?: string } };
    }>("/opportunities", query);

    const data = (raw.data.edges ?? []).map(mapToCrmDeal);
    return {
      data,
      nextCursor: raw.data.pageInfo?.endCursor,
    };
  }

  async function getDeal(externalId: string): Promise<CrmDeal> {
    const raw = await get<{ data: Record<string, unknown> }>(
      `/opportunities/${externalId}`,
    );
    return mapToCrmDeal({ node: raw.data });
  }

  async function createDeal(
    payload: Omit<CrmDeal, "id" | "businessId" | "createdAt" | "updatedAt">,
  ): Promise<CrmDeal> {
    const body = toTwentyDeal(payload);
    const raw = await post<{ data: Record<string, unknown> }>("/opportunities", body);
    return mapToCrmDeal({ node: raw.data });
  }

  async function updateDeal(
    externalId: string,
    patchPayload: Partial<
      Omit<CrmDeal, "id" | "businessId" | "createdAt" | "updatedAt">
    >,
  ): Promise<CrmDeal> {
    const body = toTwentyDeal(patchPayload);
    const raw = await patch<{ data: Record<string, unknown> }>(
      `/opportunities/${externalId}`,
      body,
    );
    return mapToCrmDeal({ node: raw.data });
  }

  // ------------------------------------------------------------------
  // Pipeline summary
  // ------------------------------------------------------------------

  async function getPipelineSummary(): Promise<CrmPipelineSummary> {
    // Twenty CRM does not have a native summary endpoint; aggregate from deals list.
    let allDeals: CrmDeal[] = [];
    let cursor: string | undefined;

    do {
      const page = await listDeals({ limit: 100, cursor });
      allDeals = allDeals.concat(page.data);
      cursor = page.nextCursor;
    } while (cursor);

    return buildPipelineSummary(allDeals);
  }

  // ------------------------------------------------------------------
  // Activity operations
  // Twenty CRM REST paths: /activities
  // ------------------------------------------------------------------

  async function listActivities(params?: {
    contactId?: string;
    dealId?: string;
    limit?: number;
  }): Promise<CrmActivity[]> {
    const query: Record<string, string> = {};
    if (params?.limit) query.limit = String(params.limit);
    if (params?.contactId) query.contactId = params.contactId;
    if (params?.dealId) query.dealId = params.dealId;

    const raw = await get<{
      data: { edges: Array<{ node: Record<string, unknown> }> };
    }>("/activities", query);

    return (raw.data.edges ?? []).map(mapToCrmActivity);
  }

  async function createActivity(
    payload: Omit<CrmActivity, "id" | "businessId" | "createdAt">,
  ): Promise<CrmActivity> {
    const body = toTwentyActivity(payload);
    const raw = await post<{ data: Record<string, unknown> }>("/activities", body);
    return mapToCrmActivity({ node: raw.data });
  }

  return {
    listContacts,
    getContact,
    createContact,
    updateContact,
    deleteContact,
    listDeals,
    getDeal,
    createDeal,
    updateDeal,
    getPipelineSummary,
    listActivities,
    createActivity,
  };
}

// ---------------------------------------------------------------------------
// Mapping helpers: Twenty API shape <-> CrmContact / CrmDeal / CrmActivity
// These assume a typical Twenty CRM REST response shape and will need
// adjustment to match the exact field names of the target Twenty instance.
// ---------------------------------------------------------------------------

function mapToCrmContact({ node }: { node: Record<string, unknown> }): CrmContact {
  return {
    id: (node.id as string) ?? "",
    businessId: "",               // Populated by crm-service from context
    externalId: (node.id as string) ?? undefined,
    firstName: (node.firstName as string) ?? (node.name as string) ?? "",
    lastName: (node.lastName as string) ?? "",
    email: (node.email as string) ?? ((node.emails as Record<string, unknown>)?.primaryEmail as string) ?? "",
    phone: (node.phone as string) ?? ((node.phones as Record<string, unknown>)?.primaryPhoneNumber as string) ?? undefined,
    company: (node.company as string) ?? undefined,
    jobTitle: (node.jobTitle as string) ?? undefined,
    source: ((node.source as string) as CrmContact["source"]) ?? "organic",
    status: ((node.status as string) as CrmContact["status"]) ?? "new",
    score: typeof node.score === "number" ? node.score : undefined,
    tags: Array.isArray(node.tags) ? (node.tags as string[]) : [],
    metadata: (node.metadata as Record<string, unknown>) ?? {},
    createdAt: (node.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (node.updatedAt as string) ?? new Date().toISOString(),
  };
}

function toTwentyContact(
  contact: Partial<Omit<CrmContact, "id" | "businessId" | "createdAt" | "updatedAt">>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (contact.firstName !== undefined) out.firstName = contact.firstName;
  if (contact.lastName !== undefined) out.lastName = contact.lastName;
  if (contact.email !== undefined) out.email = contact.email;
  if (contact.phone !== undefined) out.phone = contact.phone;
  if (contact.company !== undefined) out.company = contact.company;
  if (contact.jobTitle !== undefined) out.jobTitle = contact.jobTitle;
  if (contact.source !== undefined) out.source = contact.source;
  if (contact.status !== undefined) out.status = contact.status;
  if (contact.score !== undefined) out.score = contact.score;
  if (contact.tags !== undefined) out.tags = contact.tags;
  if (contact.metadata !== undefined) out.metadata = contact.metadata;
  return out;
}

function mapToCrmDeal({ node }: { node: Record<string, unknown> }): CrmDeal {
  return {
    id: (node.id as string) ?? "",
    businessId: "",               // Populated by crm-service from context
    contactId: (node.contactId as string) ?? "",
    title: (node.name as string) ?? (node.title as string) ?? "",
    value: typeof node.amount === "number"
      ? node.amount
      : typeof node.value === "number"
        ? node.value
        : 0,
    currency: (node.currency as string) ?? "USD",
    stage: ((node.stage as string) as CrmDeal["stage"]) ?? "lead",
    probability: typeof node.probability === "number" ? node.probability : 0,
    expectedCloseDate: (node.closeDate as string) ?? undefined,
    assignedAgentId: (node.assignedAgentId as string) ?? undefined,
    metadata: (node.metadata as Record<string, unknown>) ?? {},
    createdAt: (node.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (node.updatedAt as string) ?? new Date().toISOString(),
  };
}

function toTwentyDeal(
  deal: Partial<Omit<CrmDeal, "id" | "businessId" | "createdAt" | "updatedAt">>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (deal.title !== undefined) out.name = deal.title;
  if (deal.value !== undefined) out.amount = deal.value;
  if (deal.currency !== undefined) out.currency = deal.currency;
  if (deal.stage !== undefined) out.stage = deal.stage;
  if (deal.probability !== undefined) out.probability = deal.probability;
  if (deal.expectedCloseDate !== undefined) out.closeDate = deal.expectedCloseDate;
  if (deal.contactId !== undefined) out.contactId = deal.contactId;
  if (deal.metadata !== undefined) out.metadata = deal.metadata;
  return out;
}

function mapToCrmActivity({ node }: { node: Record<string, unknown> }): CrmActivity {
  return {
    id: (node.id as string) ?? "",
    businessId: "",               // Populated by crm-service from context
    contactId: (node.contactId as string) ?? undefined,
    dealId: (node.dealId as string) ?? undefined,
    agentId: (node.agentId as string) ?? undefined,
    type: ((node.type as string) as CrmActivity["type"]) ?? "note",
    subject: (node.subject as string) ?? (node.title as string) ?? "",
    description: (node.description as string) ?? undefined,
    createdAt: (node.createdAt as string) ?? new Date().toISOString(),
  };
}

function toTwentyActivity(
  activity: Partial<Omit<CrmActivity, "id" | "businessId" | "createdAt">>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (activity.type !== undefined) out.type = activity.type;
  if (activity.subject !== undefined) out.subject = activity.subject;
  if (activity.description !== undefined) out.description = activity.description;
  if (activity.contactId !== undefined) out.contactId = activity.contactId;
  if (activity.dealId !== undefined) out.dealId = activity.dealId;
  if (activity.agentId !== undefined) out.agentId = activity.agentId;
  return out;
}

// ---------------------------------------------------------------------------
// Pipeline summary computation
// ---------------------------------------------------------------------------

function buildPipelineSummary(deals: CrmDeal[]): CrmPipelineSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const byStage: Record<string, { count: number; value: number }> = {};
  let wonThisMonth = 0;
  let lostThisMonth = 0;

  for (const deal of deals) {
    const stage = deal.stage;
    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
    byStage[stage].count += 1;
    byStage[stage].value += deal.value;

    if (deal.stage === "closed_won" && deal.updatedAt >= monthStart) {
      wonThisMonth += 1;
    }
    if (deal.stage === "closed_lost" && deal.updatedAt >= monthStart) {
      lostThisMonth += 1;
    }
  }

  const closedTotal = wonThisMonth + lostThisMonth;
  const conversionRate = closedTotal > 0 ? wonThisMonth / closedTotal : 0;

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return {
    totalDeals: deals.length,
    totalValue,
    byStage,
    wonThisMonth,
    lostThisMonth,
    conversionRate,
  };
}
