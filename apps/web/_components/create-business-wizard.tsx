"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createBusinessSchema,
  type CreateBusinessInput,
} from "@agency-factory/core";
import { createBusiness } from "@/_actions/business-actions";

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

const INDUSTRIES = [
  { value: "general", label: "General" },
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "retail", label: "Retail" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
] as const;

const DEFAULT_DEPARTMENTS = [
  {
    name: "Owner",
    type: "owner",
    description: "Business oversight, strategic decisions, and approvals",
  },
  {
    name: "Sales",
    type: "sales",
    description: "Lead generation, outreach, and pipeline management",
  },
  {
    name: "Support",
    type: "support",
    description: "Customer support, ticket handling, and resolution",
  },
  {
    name: "Operations",
    type: "operations",
    description: "Internal workflows, scheduling, and coordination",
  },
] as const;

/** Converts a business name into a URL-safe slug */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function CreateBusinessWizard() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<CreateBusinessInput>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: {
      name: "",
      slug: "",
      industry: "general",
    },
  });

  const name = watch("name");
  const slug = watch("slug");
  const industry = watch("industry");

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      setValue("slug", slugify(name));
    }
  }, [name, slugManuallyEdited, setValue]);

  async function goToStep(nextStep: number) {
    if (nextStep > step) {
      // Validate current step fields before advancing
      const fieldsToValidate: (keyof CreateBusinessInput)[] =
        step === 0 ? ["name", "slug", "industry"] : [];
      if (fieldsToValidate.length > 0) {
        const valid = await trigger(fieldsToValidate);
        if (!valid) return;
      }
    }
    setStep(nextStep);
  }

  async function onSubmit(data: CreateBusinessInput) {
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("slug", data.slug);
    formData.set("industry", data.industry);

    try {
      const result = await createBusiness(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      // redirect() throws NEXT_REDIRECT which is expected on success
    } finally {
      setSubmitting(false);
    }
  }

  const industryLabel =
    INDUSTRIES.find((i) => i.value === industry)?.label ?? industry;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl">
      {/* Step indicators */}
      <div className="mb-8 flex items-center gap-2">
        {["Business Details", "Departments", "Review & Deploy"].map(
          (label, i) => (
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
          ),
        )}
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
              <Input
                id="name"
                placeholder="My Agency"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
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
                <p className="text-sm text-destructive">
                  {errors.slug.message}
                </p>
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
                <p className="text-sm text-destructive">
                  {errors.industry.message}
                </p>
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

      {/* Step 2: Departments */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Default Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              These 4 departments will be automatically created with your
              business. Each department comes with a starter AI agent.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {DEFAULT_DEPARTMENTS.map((dept) => (
                <div
                  key={dept.type}
                  className="rounded-lg border bg-muted/30 p-4"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{dept.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {dept.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dept.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => goToStep(0)}
            >
              Back
            </Button>
            <Button type="button" onClick={() => goToStep(2)}>
              Next
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Review & Deploy */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Deploy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Review your business configuration before creating. Everything
              below will be provisioned in a single atomic transaction.
            </p>
            <div className="space-y-4">
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
                </dl>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  What will be created
                </h3>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    4 departments (Owner, Sales, Support, Operations)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Starter AI agents from templates
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Deployment job (queued)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Owner membership for your account
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => goToStep(1)}
            >
              Back
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Business"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </form>
  );
}
