"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteTemplateAction } from "@/_actions/template-actions";

interface Template {
  id: string;
  name: string;
  department_type: string;
  description: string | null;
  system_prompt: string;
  tool_profile: Record<string, unknown>;
  model_profile: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateListProps {
  templates: Template[];
  businessId: string;
}

/**
 * Renders agent templates in a card grid with edit/delete actions.
 */
export function TemplateList({ templates, businessId }: TemplateListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(templateId: string) {
    setDeletingId(templateId);
    try {
      const result = await deleteTemplateAction(templateId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Template deleted");
      }
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <FileText className="mb-3 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No agent templates yet.
        </p>
        <p className="text-xs text-muted-foreground">
          Create your first template to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <CardTitle>{template.name}</CardTitle>
            <CardAction>
              <Badge variant="secondary">{template.department_type}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {template.description && (
              <p className="text-sm text-muted-foreground">
                {template.description}
              </p>
            )}

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                System Prompt
              </p>
              <p className="text-xs text-muted-foreground/80">
                {template.system_prompt.length > 100
                  ? `${template.system_prompt.slice(0, 100)}...`
                  : template.system_prompt}
              </p>
            </div>

            {Object.keys(template.model_profile).length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Model Profile
                </p>
                <p className="font-mono text-xs text-muted-foreground/80">
                  {Object.keys(template.model_profile).join(", ")}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Link
                href={`/businesses/${businessId}/templates/${template.id}/edit`}
                className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Pencil className="size-3" />
                Edit
              </Link>

              <AlertDialog>
                <AlertDialogTrigger
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-destructive/30 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  disabled={deletingId === template.id}
                >
                  <Trash2 className="size-3" />
                  {deletingId === template.id ? "Deleting..." : "Delete"}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Template</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{template.name}
                      &quot;? This cannot be undone. Templates referenced by
                      active agents cannot be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
