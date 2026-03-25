"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createTemplateSchema,
  type CreateTemplateInput,
} from "@agency-factory/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createTemplateAction,
  updateTemplateAction,
} from "@/_actions/template-actions";

const DEPARTMENT_TYPES = [
  { value: "owner", label: "Owner" },
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "operations", label: "Operations" },
] as const;

interface TemplateData {
  id: string;
  name: string;
  department_type: string;
  description: string | null;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
}

interface TemplateFormProps {
  businessId: string;
  template?: TemplateData;
}

/**
 * Form for creating or editing agent templates.
 * Uses react-hook-form with Zod validation from @agency-factory/core.
 */
export function TemplateForm({ businessId, template }: TemplateFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!template;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTemplateInput>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: template?.name ?? "",
      department_type:
        (template?.department_type as CreateTemplateInput["department_type"]) ??
        "owner",
      description: template?.description ?? "",
      system_prompt: template?.system_prompt ?? "",
      tool_profile: template?.tool_profile ?? undefined,
      model_profile: template?.model_profile ?? undefined,
    },
  });

  const departmentType = watch("department_type");

  async function onSubmit(data: CreateTemplateInput) {
    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("department_type", data.department_type);
    formData.set("description", data.description ?? "");
    formData.set("system_prompt", data.system_prompt);
    formData.set(
      "tool_profile",
      data.tool_profile ? JSON.stringify(data.tool_profile) : "",
    );
    formData.set(
      "model_profile",
      data.model_profile ? JSON.stringify(data.model_profile) : "",
    );

    try {
      const result = isEdit
        ? await updateTemplateAction(template.id, formData)
        : await createTemplateAction(formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? "Template updated" : "Template created");
        router.push(`/businesses/${businessId}/templates`);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Edit Template" : "New Template"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Sales Outreach Agent"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Department Type */}
          <div className="space-y-2">
            <Label htmlFor="department_type">Department</Label>
            <Select
              value={departmentType}
              onValueChange={(val: string | null) => {
                if (val) {
                  setValue(
                    "department_type",
                    val as CreateTemplateInput["department_type"],
                  );
                }
              }}
            >
              <SelectTrigger id="department_type">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_TYPES.map((dept) => (
                  <SelectItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.department_type && (
              <p className="text-sm text-destructive">
                {errors.department_type.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of what this template does..."
              rows={2}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <Label htmlFor="system_prompt">System Prompt</Label>
            <Textarea
              id="system_prompt"
              placeholder="You are an AI agent for {{business_name}}. Your role is..."
              rows={6}
              {...register("system_prompt")}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{business_name}}"} as a placeholder for the tenant name.
            </p>
            {errors.system_prompt && (
              <p className="text-sm text-destructive">
                {errors.system_prompt.message}
              </p>
            )}
          </div>

          {/* Tool Profile (JSON) */}
          <div className="space-y-2">
            <Label htmlFor="tool_profile">Tool Profile (optional JSON)</Label>
            <Textarea
              id="tool_profile"
              placeholder="{}"
              rows={3}
              defaultValue={
                template?.tool_profile &&
                Object.keys(template.tool_profile).length > 0
                  ? JSON.stringify(template.tool_profile, null, 2)
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value.trim();
                if (!val) {
                  setValue("tool_profile", undefined);
                  return;
                }
                try {
                  setValue("tool_profile", JSON.parse(val));
                } catch {
                  // Allow typing invalid JSON mid-edit
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              JSON object defining available tools for this agent type.
            </p>
          </div>

          {/* Model Profile (JSON) */}
          <div className="space-y-2">
            <Label htmlFor="model_profile">Model Profile (optional JSON)</Label>
            <Textarea
              id="model_profile"
              placeholder="{}"
              rows={3}
              defaultValue={
                template?.model_profile &&
                Object.keys(template.model_profile).length > 0
                  ? JSON.stringify(template.model_profile, null, 2)
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value.trim();
                if (!val) {
                  setValue("model_profile", undefined);
                  return;
                }
                try {
                  setValue("model_profile", JSON.parse(val));
                } catch {
                  // Allow typing invalid JSON mid-edit
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              JSON object defining model configuration (provider, model name,
              temperature, etc).
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/businesses/${businessId}/templates`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? isEdit
                ? "Updating..."
                : "Creating..."
              : isEdit
                ? "Update Template"
                : "Create Template"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
