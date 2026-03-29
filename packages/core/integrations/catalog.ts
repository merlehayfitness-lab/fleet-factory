// Static integration catalog for the browsable catalog dialog.
// Each entry represents a known integration that can be added to departments or agents.

import type { IntegrationType } from "../types/index";

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: IntegrationType;
  provider: string;
  logoUrl: string;
  isReal: boolean;
  defaultConfig?: Record<string, unknown>;
}

export const INTEGRATION_CATALOG: CatalogEntry[] = [
  // CRM
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Customer relationship management and sales pipeline",
    category: "crm",
    provider: "hubspot",
    logoUrl: "/integrations/hubspot.svg",
    isReal: true,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Enterprise CRM platform",
    category: "crm",
    provider: "salesforce",
    logoUrl: "/integrations/salesforce.svg",
    isReal: false,
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Sales pipeline and deal management",
    category: "crm",
    provider: "pipedrive",
    logoUrl: "/integrations/pipedrive.svg",
    isReal: false,
  },
  // Email
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Transactional and marketing email delivery",
    category: "email",
    provider: "sendgrid",
    logoUrl: "/integrations/sendgrid.svg",
    isReal: true,
  },
  {
    id: "mailgun",
    name: "Mailgun",
    description: "Email sending and routing API",
    category: "email",
    provider: "mailgun",
    logoUrl: "/integrations/mailgun.svg",
    isReal: false,
  },
  {
    id: "ses",
    name: "Amazon SES",
    description: "Scalable cloud email service",
    category: "email",
    provider: "ses",
    logoUrl: "/integrations/ses.svg",
    isReal: false,
  },
  // Helpdesk
  {
    id: "zendesk",
    name: "Zendesk",
    description: "Customer support ticketing and help center",
    category: "helpdesk",
    provider: "zendesk",
    logoUrl: "/integrations/zendesk.svg",
    isReal: false,
  },
  {
    id: "freshdesk",
    name: "Freshdesk",
    description: "Customer support and helpdesk platform",
    category: "helpdesk",
    provider: "freshdesk",
    logoUrl: "/integrations/freshdesk.svg",
    isReal: false,
  },
  {
    id: "intercom",
    name: "Intercom",
    description: "Customer messaging and support platform",
    category: "helpdesk",
    provider: "intercom",
    logoUrl: "/integrations/intercom.svg",
    isReal: false,
  },
  // Calendar
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Scheduling and calendar management",
    category: "calendar",
    provider: "google-calendar",
    logoUrl: "/integrations/google-calendar.svg",
    isReal: false,
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    description: "Microsoft calendar and scheduling",
    category: "calendar",
    provider: "outlook-calendar",
    logoUrl: "/integrations/outlook-calendar.svg",
    isReal: false,
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Automated meeting scheduling and booking",
    category: "calendar",
    provider: "calendly",
    logoUrl: "/integrations/calendly.svg",
    isReal: false,
  },
  // Messaging
  {
    id: "slack",
    name: "Slack",
    description: "Team messaging and collaboration",
    category: "messaging",
    provider: "slack",
    logoUrl: "/integrations/slack.svg",
    isReal: false,
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Team communication and collaboration",
    category: "messaging",
    provider: "teams",
    logoUrl: "/integrations/teams.svg",
    isReal: false,
  },
  {
    id: "discord",
    name: "Discord",
    description: "Community chat and voice platform",
    category: "messaging",
    provider: "discord",
    logoUrl: "/integrations/discord.svg",
    isReal: false,
  },
];

/**
 * Group catalog entries by their IntegrationType category.
 */
export function getCatalogByCategory(): Record<IntegrationType, CatalogEntry[]> {
  const grouped: Record<IntegrationType, CatalogEntry[]> = {
    crm: [],
    email: [],
    helpdesk: [],
    calendar: [],
    messaging: [],
  };

  for (const entry of INTEGRATION_CATALOG) {
    grouped[entry.category].push(entry);
  }

  return grouped;
}

/**
 * Find a catalog entry by its unique id.
 */
export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return INTEGRATION_CATALOG.find((entry) => entry.id === id);
}
