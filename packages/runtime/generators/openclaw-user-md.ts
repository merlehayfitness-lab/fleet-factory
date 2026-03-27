/**
 * Generates USER.md for an OpenClaw workspace.
 * Provides business context for the agent: name, industry, slug, and general preferences.
 * Enforces max 3000 char budget.
 */

const MAX_CHARS = 3000;

const INDUSTRY_CONTEXT: Record<string, string> = {
  general: "This is a general-purpose business. Adapt your communication style to the specific context of each interaction.",
  technology: "This is a technology company. Use precise technical language when appropriate, but keep explanations accessible for non-technical stakeholders.",
  healthcare: "This is a healthcare organization. Maintain strict confidentiality. Never provide medical advice. Follow HIPAA-aware communication patterns.",
  finance: "This is a financial services company. Be precise with numbers and terminology. Follow compliance-aware communication patterns.",
  retail: "This is a retail business. Focus on customer experience and product knowledge. Maintain brand voice consistency.",
  education: "This is an educational institution. Use clear, instructive language. Be patient with explanations and encourage learning.",
  legal: "This is a legal services firm. Be precise with terminology. Include appropriate disclaimers. Never provide legal advice without proper qualification.",
  manufacturing: "This is a manufacturing company. Focus on efficiency, quality metrics, and supply chain terminology.",
  marketing: "This is a marketing agency. Be creative but data-informed. Focus on ROI and campaign performance metrics.",
  consulting: "This is a consulting firm. Be analytical and structured. Present findings with supporting evidence.",
};

export function generateUserMd(
  businessName: string,
  businessIndustry: string,
  businessSlug: string,
): string {
  const industryContext = INDUSTRY_CONTEXT[businessIndustry] || INDUSTRY_CONTEXT.general;

  let content = `# Business Context\n\n`;

  content += `## Organization\n\n`;
  content += `- **Business:** ${businessName}\n`;
  content += `- **Industry:** ${businessIndustry.charAt(0).toUpperCase() + businessIndustry.slice(1)}\n`;
  content += `- **Identifier:** ${businessSlug}\n`;
  content += "\n";

  content += `## Industry Context\n\n`;
  content += `${industryContext}\n\n`;

  content += `## Preferences\n\n`;
  content += `- Use the business name "${businessName}" when referring to the organization\n`;
  content += `- Maintain a professional tone consistent with ${businessIndustry} industry standards\n`;
  content += `- When in doubt about a process, ask for clarification rather than assuming\n`;
  content += `- All times are displayed in the user's local timezone\n`;

  if (content.length > MAX_CHARS) {
    content = content.slice(0, MAX_CHARS - 3) + "...";
  }

  return content;
}
