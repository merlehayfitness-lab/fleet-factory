"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2, Plus, Loader2, Key, Lock, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CardHeader,
  CardTitle,
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
} from "@/components/ui/alert-dialog";
import { saveSecretAction, deleteSecretAction } from "@/_actions/secrets-actions";
import { Badge } from "@/components/ui/badge";

interface Secret {
  id: string;
  business_id: string;
  key: string;
  encrypted_value: string;
  category: string;
  integration_type: string | null;
  created_at: string;
  updated_at: string;
}

interface SecretsManagerProps {
  secrets: Secret[];
  businessId: string;
}

const CATEGORY_CONFIG = {
  api_key: { label: "API Keys", icon: Key },
  credential: { label: "Credentials", icon: Lock },
  token: { label: "Tokens", icon: Ticket },
} as const;

const INTEGRATION_TYPES = [
  { value: "crm", label: "CRM" },
  { value: "email", label: "Email" },
  { value: "helpdesk", label: "Helpdesk" },
  { value: "calendar", label: "Calendar" },
  { value: "messaging", label: "Messaging" },
] as const;

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Categorized secret management UI (Vercel env vars style).
 * Secrets are encrypted server-side and never decrypted client-side.
 */
export function SecretsManager({ secrets, businessId }: SecretsManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState("api_key");
  const [newIntegrationType, setNewIntegrationType] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Secret | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group secrets by category
  const grouped = secrets.reduce(
    (acc, secret) => {
      const cat = secret.category || "api_key";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(secret);
      return acc;
    },
    {} as Record<string, Secret[]>
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) {
      toast.error("Key and value are required");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveSecretAction(
        businessId,
        newKey.trim().toUpperCase(),
        newValue.trim(),
        newCategory,
        newIntegrationType || undefined
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Secret saved");
        setNewKey("");
        setNewValue("");
        setNewIntegrationType("");
      }
    } catch {
      toast.error("Failed to save secret");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteSecretAction(businessId, deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Deleted ${deleteTarget.key}`);
        setDeleteTarget(null);
      }
    } catch {
      toast.error("Failed to delete secret");
    } finally {
      setIsDeleting(false);
    }
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-8">
      {/* Add Secret Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Add Secret</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="secret-key">Key</Label>
                <Input
                  id="secret-key"
                  placeholder="e.g. OPENAI_API_KEY"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Will be converted to UPPERCASE
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret-value">Value</Label>
                <Input
                  id="secret-value"
                  type="password"
                  placeholder="Enter secret value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={(v) => v && setNewCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="credential">Credential</SelectItem>
                    <SelectItem value="token">Token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Integration Type (optional)</Label>
                <Select
                  value={newIntegrationType}
                  onValueChange={(v) => setNewIntegrationType(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {INTEGRATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={isSaving} size="sm">
              {isSaving ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 size-3.5" />
              )}
              Add Secret
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Secrets List */}
      {secrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Lock className="mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No secrets configured.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Add API keys and credentials for your integrations.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map(
            (category) => {
              const categorySecrets = grouped[category];
              if (!categorySecrets || categorySecrets.length === 0) return null;

              const config = CATEGORY_CONFIG[category];
              const Icon = config.icon;

              return (
                <div key={category}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Icon className="size-4" />
                    {config.label}
                  </h3>
                  <div className="space-y-2">
                    {categorySecrets.map((secret) => {
                      const isRevealed = revealedIds.has(secret.id);

                      return (
                        <div
                          key={secret.id}
                          className="flex items-center justify-between rounded-md border px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-semibold">
                              {secret.key}
                            </span>
                            {secret.integration_type && (
                              <Badge variant="outline" className="text-xs">
                                {secret.integration_type}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-muted-foreground">
                              {isRevealed
                                ? "Value stored securely"
                                : "**********************"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(secret.updated_at)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleReveal(secret.id)}
                              className="size-8 p-0"
                            >
                              {isRevealed ? (
                                <EyeOff className="size-3.5" />
                              ) : (
                                <Eye className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(secret)}
                              className="size-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-mono font-semibold">
                {deleteTarget?.key}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
