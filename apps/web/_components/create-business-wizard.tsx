"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createBusinessSchema,
  type CreateBusinessInput,
} from "@agency-factory/core";
import { createBusinessV2, validateApiKey } from "@/_actions/business-actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  DepartmentTreeSelect,
  type DepartmentTemplate,
} from "./department-tree-select";
import { WizardApiKeysStep, type ApiKeyEntry } from "./wizard-api-keys-step";
import { WizardSubdomainStep } from "./wizard-subdomain-step";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  { value: "general", label: "General" },
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "retail", label: "Retail" },
  { value: "education", label: "Education" },
  { value: "marketing", label: "Marketing" },
  { value: "consulting", label: "Consulting" },
  { value: "other", label: "Other" },
] as const;

const STEPS = [
  "Business Details",
  "Departments",
  "API Keys",
  "Subdomain",
  "Review & Deploy",
] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

// ---------------------------------------------------------------------------
// Static templates (fetched from DB in production — stubbed for now)
// ---------------------------------------------------------------------------

const DEPARTMENT_TEMPLATES: DepartmentTemplate[] = [
  { id: "ceo", name: "CEO Agent", departmentType: "executive", description: "Chief executive — deploys first, orchestrates all departments", roleLevel: 0, reportingChain: "ceo", tokenBudget: 250000 },
  // Marketing
  { id: "mkt-dir", name: "Marketing Director", departmentType: "marketing", description: "Oversees content, SEO, outreach, and social strategy", roleLevel: 1, reportingChain: "ceo.marketing", tokenBudget: 150000 },
  { id: "mkt-content", name: "Content Writer", departmentType: "marketing", description: "Blog posts, newsletters, landing page copy", roleLevel: 2, reportingChain: "ceo.marketing.content", tokenBudget: 100000 },
  { id: "mkt-seo", name: "SEO Analyst", departmentType: "marketing", description: "Keyword research, rank tracking, technical SEO", roleLevel: 2, reportingChain: "ceo.marketing.seo", tokenBudget: 80000 },
  { id: "mkt-outreach", name: "Cold Outreach Agent", departmentType: "marketing", description: "Cold email and LinkedIn outreach campaigns", roleLevel: 2, reportingChain: "ceo.marketing.outreach", tokenBudget: 80000 },
  { id: "mkt-social", name: "Social Media Manager", departmentType: "marketing", description: "Social content calendar and engagement", roleLevel: 2, reportingChain: "ceo.marketing.social", tokenBudget: 80000 },
  // Sales
  { id: "sales-head", name: "Sales Director", departmentType: "sales", description: "Lead generation, pipeline management, deal closing", roleLevel: 1, reportingChain: "ceo.sales", tokenBudget: 150000 },
  { id: "sales-qualifier", name: "Lead Qualifier", departmentType: "sales", description: "Scores and qualifies inbound/outbound leads", roleLevel: 2, reportingChain: "ceo.sales.qualifier", tokenBudget: 80000 },
  { id: "sales-proposal", name: "Proposal Writer", departmentType: "sales", description: "Sales proposals, pricing quotes, contracts", roleLevel: 2, reportingChain: "ceo.sales.proposals", tokenBudget: 100000 },
  { id: "sales-crm", name: "CRM Manager", departmentType: "sales", description: "CRM hygiene, pipeline reporting, data quality", roleLevel: 2, reportingChain: "ceo.sales.crm", tokenBudget: 80000 },
  // Operations
  { id: "ops-head", name: "Operations Director", departmentType: "operations", description: "Workflows, scheduling, and coordination", roleLevel: 1, reportingChain: "ceo.operations", tokenBudget: 120000 },
  { id: "ops-tasks", name: "Task Manager", departmentType: "operations", description: "Task creation, assignment, and tracking", roleLevel: 2, reportingChain: "ceo.operations.tasks", tokenBudget: 80000 },
  { id: "ops-scheduler", name: "Scheduler", departmentType: "operations", description: "Calendar management and resource allocation", roleLevel: 2, reportingChain: "ceo.operations.scheduler", tokenBudget: 60000 },
  { id: "ops-reporting", name: "Reporting Analyst", departmentType: "operations", description: "Cross-department reports and KPI dashboards", roleLevel: 2, reportingChain: "ceo.operations.reporting", tokenBudget: 100000 },
  // Support
  { id: "support-head", name: "Support Director", departmentType: "support", description: "Customer support and ticket resolution", roleLevel: 1, reportingChain: "ceo.support", tokenBudget: 120000 },
  { id: "support-tickets", name: "Ticket Handler", departmentType: "support", description: "First-line triage and ticket resolution", roleLevel: 2, reportingChain: "ceo.support.tickets", tokenBudget: 80000 },
  { id: "support-kb", name: "Knowledge Base Manager", departmentType: "support", description: "Knowledge base articles and FAQ maintenance", roleLevel: 2, reportingChain: "ceo.support.knowledge", tokenBudget: 80000 },
  { id: "support-escalation", name: "Escalation Manager", departmentType: "support", description: "Escalated issues and VIP customer management", roleLevel: 2, reportingChain: "ceo.support.escalation", tokenBudget: 100000 },
  // R&D
  { id: "rd-claude", name: "R&D Lead (Claude)", departmentType: "rd", description: "Reasoning and code analysis specialist", roleLevel: 2, reportingChain: "ceo.rd.claude", tokenBudget: 100000 },
  { id: "rd-gpt4", name: "R&D Analyst (GPT-4)", departmentType: "rd", description: "Data analysis and creative ideation", roleLevel: 2, reportingChain: "ceo.rd.gpt4", tokenBudget: 100000 },
  { id: "rd-gemini", name: "R&D Strategist (Gemini)", departmentType: "rd", description: "Multimodal analysis and web search", roleLevel: 2, reportingChain: "ceo.rd.gemini", tokenBudget: 80000 },
  { id: "rd-mistral", name: "R&D Engineer (Mistral)", departmentType: "rd", description: "Efficient code generation and prototyping", roleLevel: 2, reportingChain: "ceo.rd.mistral", tokenBudget: 60000 },
  { id: "rd-deepseek", name: "R&D Researcher (DeepSeek)", departmentType: "rd", description: "Deep technical research and math", roleLevel: 2, reportingChain: "ceo.rd.deepseek", tokenBudget: 60000 },
];

// Default selection: CEO + all department heads + a few key specialists
const DEFAULT_SELECTED = new Set([
  "ceo",
  "mkt-dir", "mkt-content", "mkt-seo",
  "sales-head", "sales-qualifier", "sales-crm",
  "ops-head", "ops-tasks", "ops-reporting",
  "support-head", "support-tickets",
]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateBusinessWizard() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [deployProgress, setDeployProgress] = useState<string[]>([]);

  // V2 state
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(DEFAULT_SELECTED);
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [subdomain, setSubdomain] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<CreateBusinessInput>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: { name: "", slug: "", industry: "general" },
  });

  const name = watch("name");
  const slug = watch("slug");
  const industry = watch("industry");

  useEffect(() => {
    if (!slugManuallyEdited && name) {
      setValue("slug", slugify(name));
    }
  }, [name, slugManuallyEdited, setValue]);

  const handleSubdomainChange = useCallback((value: string) => {
    setSubdomain(value);
  }, []);

  async function goToStep(nextStep: number) {
    if (nextStep > step) {
      if (step === 0) {
        const valid = await trigger(["name", "slug", "industry"]);
        if (!valid) return;
      }
      if (step === 1 && selectedTemplates.size === 0) return;
      if (step === 2) {
        const anthropicKey = apiKeys.find((k) => k.provider === "anthropic");
        if (!anthropicKey || anthropicKey.key.length < 10) {
          setError("An Anthropic API key is required");
          return;
        }
        // Validate Anthropic key via real API call before advancing
        try {
          const result = await validateApiKey("anthropic", anthropicKey.key);
          if (!result.valid) {
            setError(
              `Anthropic API key validation failed: ${result.error ?? "Invalid key"}`,
            );
            return;
          }
        } catch {
          setError("Failed to validate Anthropic API key");
          return;
        }
        setError(null);
      }
    }
    setStep(nextStep);
  }

  async function onSubmit(data: CreateBusinessInput) {
    setSubmitting(true);
    setError(null);
    setDeployProgress(["Starting business provisioning..."]);

    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("slug", data.slug);
    formData.set("industry", data.industry);
    formData.set("subdomain", subdomain);
    formData.set("selectedTemplates", JSON.stringify(Array.from(selectedTemplates)));
    formData.set("apiKeys", JSON.stringify(apiKeys));

    try {
      const result = await createBusinessV2(formData);
      if (result?.error) {
        setError(result.error);
        setDeployProgress((prev) => [...prev, `Error: ${result.error}`]);
      }
    } catch {
      // redirect() throws NEXT_REDIRECT which is expected on success
    } finally {
      setSubmitting(false);
    }
  }

  const industryLabel =
    INDUSTRIES.find((i) => i.value === industry)?.label ?? industry;

  const selectedCount = selectedTemplates.size;
  const totalBudget = DEPARTMENT_TEMPLATES
    .filter((t) => selectedTemplates.has(t.id))
    .reduce((sum, t) => sum + t.tokenBudget, 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl">
      {/* Step indicators */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => goToStep(i)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold text-foreground">
              {i + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 1: Business Details */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
              <Input id="name" placeholder="My Agency" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="my-agency"
                {...register("slug", {
                  onChange: () => setSlugManuallyEdited(true),
                })}
              />
              <p className="text-xs text-muted-foreground">
                URL-safe identifier. Auto-generated from name.
              </p>
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={industry}
                onValueChange={(val: string | null) => {
                  if (val) setValue("industry", val);
                }}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind.value} value={ind.value}>
                      {ind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.industry && (
                <p className="text-sm text-destructive">{errors.industry.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" onClick={() => goToStep(1)}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Department Selection */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Departments & Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Choose which AI agents to deploy. The CEO agent is always included
              and deploys first. Department heads auto-select their specialists.
            </p>
            <DepartmentTreeSelect
              templates={DEPARTMENT_TEMPLATES}
              selected={selectedTemplates}
              onSelectionChange={setSelectedTemplates}
            />
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="outline" onClick={() => goToStep(0)}>
              Back
            </Button>
            <Button type="button" onClick={() => goToStep(2)}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: API Keys */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <WizardApiKeysStep apiKeys={apiKeys} onApiKeysChange={setApiKeys} />
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="outline" onClick={() => goToStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => goToStep(3)}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Subdomain */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Subdomain</CardTitle>
          </CardHeader>
          <CardContent>
            <WizardSubdomainStep
              slug={slug}
              subdomain={subdomain}
              onSubdomainChange={handleSubdomainChange}
            />
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="outline" onClick={() => goToStep(2)}>
              Back
            </Button>
            <Button type="button" onClick={() => goToStep(4)}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 5: Review & Deploy */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Deploy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Business summary */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Business
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{name || "-"}</dd>
                  <dt className="text-muted-foreground">Slug</dt>
                  <dd className="font-mono text-xs">{slug || "-"}</dd>
                  <dt className="text-muted-foreground">Industry</dt>
                  <dd>{industryLabel}</dd>
                  <dt className="text-muted-foreground">Subdomain</dt>
                  <dd className="font-mono text-xs">
                    {subdomain ? `${subdomain}.agencyfactory.ai` : "-"}
                  </dd>
                </dl>
              </div>

              {/* Agents summary */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Agents ({selectedCount})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {DEPARTMENT_TEMPLATES.filter((t) => selectedTemplates.has(t.id)).map(
                    (t) => (
                      <Badge key={t.id} variant="secondary" className="text-xs">
                        {t.name}
                      </Badge>
                    ),
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Total daily token budget: {(totalBudget / 1000).toFixed(0)}k tokens
                </p>
              </div>

              {/* API Keys summary */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  API Keys
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {apiKeys
                    .filter((k) => k.key.length > 0)
                    .map((k) => (
                      <Badge key={k.provider} variant="secondary" className="text-xs">
                        {k.provider}: ****{k.key.slice(-4)}
                      </Badge>
                    ))}
                  {apiKeys.filter((k) => k.key.length > 0).length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      No keys configured
                    </span>
                  )}
                </div>
              </div>

              {/* What will be created */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  What will be created
                </h3>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {selectedCount} AI agents across{" "}
                    {new Set(
                      DEPARTMENT_TEMPLATES.filter((t) => selectedTemplates.has(t.id)).map(
                        (t) => t.departmentType,
                      ),
                    ).size}{" "}
                    departments
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    CEO deploys first, then hires sub-agents
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Encrypted API key storage
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    VPS deployment with port allocation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Persistent memory for all agents
                  </li>
                </ul>
              </div>

              {/* Deploy progress */}
              {submitting && deployProgress.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-2 text-sm font-medium">Deploy Progress</h3>
                  <div className="space-y-1 font-mono text-xs">
                    {deployProgress.map((line, i) => (
                      <p key={i} className="text-muted-foreground">
                        {line}
                      </p>
                    ))}
                    <p className="animate-pulse text-primary">Deploying...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => goToStep(3)}
              disabled={submitting}
            >
              Back
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Deploying..." : "Deploy Business"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </form>
  );
}
