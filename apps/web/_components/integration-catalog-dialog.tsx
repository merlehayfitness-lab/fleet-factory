"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Check, Search } from "lucide-react";
import { toast } from "sonner";
import {
  getCatalogByCategory,
  type CatalogEntry,
} from "@agency-factory/core";
import { CatalogTargetPicker } from "@/_components/catalog-target-picker";
import { addCatalogIntegrationAction } from "@/_actions/integration-actions";

interface Department {
  id: string;
  name: string;
  type: string;
}

interface Agent {
  id: string;
  name: string;
  department_id: string;
}

interface IntegrationCatalogDialogProps {
  businessId: string;
  departments: Department[];
  agents: Agent[];
  trigger: React.ReactNode;
  preSelectedAgentId?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  crm: "CRM",
  email: "Email",
  helpdesk: "Helpdesk",
  calendar: "Calendar",
  messaging: "Messaging",
};

/**
 * Multi-step dialog for browsing the integration catalog and assigning to targets.
 *
 * Step 1: Browse & search integrations grouped by category.
 * Step 2: Select assignment targets (departments and/or agents).
 * Step 3: Confirmation with summary.
 */
export function IntegrationCatalogDialog({
  businessId,
  departments,
  agents,
  trigger,
  preSelectedAgentId,
}: IntegrationCatalogDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isCreating, startTransition] = useTransition();
  const [createdCount, setCreatedCount] = useState(0);
  const router = useRouter();

  function resetState() {
    setStep(1);
    setSelectedEntry(null);
    setSearchQuery("");
    setSelectedDepartments([]);
    setSelectedAgents(preSelectedAgentId ? [preSelectedAgentId] : []);
    setCreatedCount(0);
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      resetState();
    } else if (preSelectedAgentId) {
      setSelectedAgents([preSelectedAgentId]);
    }
    setOpen(newOpen);
  }

  function handleSelectEntry(entry: CatalogEntry) {
    setSelectedEntry(entry);
    setStep(2);
  }

  function handleBack() {
    if (step === 2) {
      setSelectedEntry(null);
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  }

  function handleAddIntegration() {
    if (!selectedEntry) return;
    const totalTargets = selectedDepartments.length + selectedAgents.length;
    if (totalTargets === 0) return;

    startTransition(async () => {
      const result = await addCatalogIntegrationAction(
        businessId,
        selectedEntry.id,
        selectedDepartments,
        selectedAgents
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setCreatedCount(result.integrationIds?.length ?? totalTargets);
      setStep(3);
      router.refresh();
    });
  }

  const catalogByCategory = getCatalogByCategory();
  const totalTargets = selectedDepartments.length + selectedAgents.length;

  // Pre-selected agent name for display
  const preSelectedAgentName = preSelectedAgentId
    ? agents.find((a) => a.id === preSelectedAgentId)?.name
    : undefined;

  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          {/* Step 1: Browse & Select */}
          {step === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>Add Integration</DialogTitle>
                <DialogDescription>
                  Browse available integrations by category
                </DialogDescription>
              </DialogHeader>

              {preSelectedAgentName && (
                <p className="text-xs text-muted-foreground">
                  Adding integration for{" "}
                  <span className="font-medium text-foreground">
                    {preSelectedAgentName}
                  </span>
                </p>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search integrations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Catalog by category */}
              <div className="max-h-80 space-y-4 overflow-y-auto">
                {Object.entries(catalogByCategory).map(([category, entries]) => {
                  const filtered = entries.filter((e) =>
                    e.name
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  );
                  if (filtered.length === 0) return null;

                  return (
                    <div key={category} className="space-y-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[category] ?? category}
                      </h3>
                      {filtered.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleSelectEntry(entry)}
                          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/50"
                        >
                          <Image
                            src={entry.logoUrl}
                            width={32}
                            height={32}
                            alt={entry.name}
                            className="shrink-0 rounded-md"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{entry.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {entry.description}
                            </p>
                          </div>
                          {entry.isReal && (
                            <Badge
                              variant="secondary"
                              className="ml-auto shrink-0 text-[10px]"
                            >
                              Live
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 2: Assign Targets */}
          {step === 2 && selectedEntry && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-md p-1 transition-colors hover:bg-accent"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <Image
                    src={selectedEntry.logoUrl}
                    width={24}
                    height={24}
                    alt={selectedEntry.name}
                    className="rounded"
                  />
                  <DialogTitle>Add {selectedEntry.name}</DialogTitle>
                </div>
                <DialogDescription>
                  Select departments or agents to assign this integration
                </DialogDescription>
              </DialogHeader>

              <CatalogTargetPicker
                departments={departments}
                agents={agents}
                selectedDepartments={selectedDepartments}
                selectedAgents={selectedAgents}
                onDepartmentsChange={setSelectedDepartments}
                onAgentsChange={setSelectedAgents}
              />

              <DialogFooter>
                <Button
                  onClick={handleAddIntegration}
                  disabled={totalTargets === 0 || isCreating}
                >
                  {isCreating && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  Add Integration
                  {totalTargets > 0 && ` (${totalTargets})`}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div className="flex items-center gap-2">
                    <Check className="size-5 text-green-500" />
                    Integration Added
                  </div>
                </DialogTitle>
                <DialogDescription>
                  {selectedEntry.name} added to {createdCount} target
                  {createdCount !== 1 ? "s" : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                {selectedDepartments.map((deptId) => {
                  const dept = departments.find((d) => d.id === deptId);
                  return (
                    <div
                      key={deptId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check className="size-3.5 text-green-500" />
                      <span>{dept?.name ?? "Department"} Department</span>
                    </div>
                  );
                })}
                {selectedAgents.map((agentId) => {
                  const agent = agents.find((a) => a.id === agentId);
                  return (
                    <div
                      key={agentId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check className="size-3.5 text-green-500" />
                      <span>{agent?.name ?? "Agent"}</span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Setup instructions will appear here after plan 12-02.
              </p>

              <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
