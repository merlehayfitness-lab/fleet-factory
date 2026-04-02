"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createTemplateSchema,
  type CreateTemplateInput,
  type ToolProfileShape,
  DEPARTMENT_DEFAULT_MODELS,
  DEPARTMENT_DEFAULT_TOOL_PROFILES,
  EMPTY_TOOL_PROFILE,
  getDefaultModelForDepartment,
} from "@fleet-factory/core";
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
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import {
  createTemplateAction,
  updateTemplateAction,
} from "@/_actions/template-actions";
import { ModelSelector } from "./model-selector";
import { ProfileEditorDrawer } from "./profile-editor-drawer";

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

/** Extract model ID from a model_profile object. */
function extractModelId(mp: Record<string, unknown> | undefined): string | undefined {
  if (!mp || typeof mp !== "object") return undefined;
  const model = mp.model;
  return typeof model === "string" ? model : undefined;
}

/** Parse a Record into ToolProfileShape, or return default. */
function parseToolProfile(
  tp: Record<string, unknown> | undefined,
  defaultProfile: ToolProfileShape,
): ToolProfileShape {
  if (!tp || typeof tp !== "object") return defaultProfile;
  return {
    allowed_tools: Array.isArray(tp.allowed_tools)
      ? (tp.allowed_tools as string[])
      : defaultProfile.allowed_tools,
    mcp_servers: Array.isArray(tp.mcp_servers)
      ? (tp.mcp_servers as ToolProfileShape["mcp_servers"])
      : defaultProfile.mcp_servers,
  };
}

/**
 * Form for creating or editing agent templates.
 * Uses ModelSelector for model selection and ProfileEditorDrawer for tool profile editing.
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
  const prevDeptRef = useRef(departmentType);

  // Model state
  const [modelId, setModelId] = useState<string>(
    extractModelId(template?.model_profile) ??
      getDefaultModelForDepartment(template?.department_type ?? "owner"),
  );

  // Tool profile state
  const defaultToolProfile =
    DEPARTMENT_DEFAULT_TOOL_PROFILES[template?.department_type ?? "owner"] ??
    EMPTY_TOOL_PROFILE;
  const [toolProfile, setToolProfile] = useState<ToolProfileShape>(
    parseToolProfile(template?.tool_profile, defaultToolProfile),
  );

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-switch defaults when department type changes
  useEffect(() => {
    const prevDept = prevDeptRef.current;
    if (prevDept === departmentType) return;

    // Only auto-switch if user hasn't customized from previous department's default
    const prevDefaultModel = DEPARTMENT_DEFAULT_MODELS[prevDept] ?? "";
    if (modelId === prevDefaultModel) {
      const newModel = getDefaultModelForDepartment(departmentType);
      setModelId(newModel);
      setValue("model_profile", { model: newModel });
    }

    const prevDefaultTools =
      DEPARTMENT_DEFAULT_TOOL_PROFILES[prevDept] ?? EMPTY_TOOL_PROFILE;
    if (
      JSON.stringify(toolProfile) === JSON.stringify(prevDefaultTools)
    ) {
      const newTools =
        DEPARTMENT_DEFAULT_TOOL_PROFILES[departmentType] ?? EMPTY_TOOL_PROFILE;
      setToolProfile(newTools);
      setValue("tool_profile", newTools as unknown as Record<string, unknown>);
    }

    prevDeptRef.current = departmentType;
  }, [departmentType, modelId, toolProfile, setValue]);

  function handleModelChange(newModelId: string) {
    setModelId(newModelId);
    setValue("model_profile", { model: newModelId });
  }

  function handleToolProfileSave(updated: ToolProfileShape) {
    setToolProfile(updated);
    setValue("tool_profile", updated as unknown as Record<string, unknown>);
  }

  async function onSubmit(data: CreateTemplateInput) {
    setSubmitting(true);

    // Override model_profile and tool_profile from component state
    const modelProfile = { model: modelId };
    const toolProf = toolProfile;

    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("department_type", data.department_type);
    formData.set("description", data.description ?? "");
    formData.set("system_prompt", data.system_prompt);
    formData.set("tool_profile", JSON.stringify(toolProf));
    formData.set("model_profile", JSON.stringify(modelProfile));

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

  const toolCount = toolProfile.allowed_tools.includes("*")
    ? "All"
    : String(toolProfile.allowed_tools.length);
  const mcpCount = toolProfile.mcp_servers.length;

  return (
    <>
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
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
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

            {/* Model Profile -- ModelSelector dropdown */}
            <div className="space-y-2">
              <Label>Model</Label>
              <ModelSelector
                value={modelId}
                onValueChange={handleModelChange}
              />
            </div>

            {/* Tool Profile -- Summary card with Edit button */}
            <div className="space-y-2">
              <Label>Tool Profile</Label>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {toolCount} tools allowed, {mcpCount} MCP server
                    {mcpCount !== 1 ? "s" : ""}
                  </span>
                  {toolProfile.allowed_tools.includes("*") && (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-800 text-xs dark:bg-emerald-900/30 dark:text-emerald-400"
                    >
                      Unrestricted
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDrawerOpen(true)}
                >
                  Edit
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(`/businesses/${businessId}/templates`)
              }
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

      {/* Tool Profile Drawer */}
      <ProfileEditorDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Edit Tool Profile"
        profile={toolProfile}
        onSave={handleToolProfileSave}
        businessId={businessId}
      />
    </>
  );
}
