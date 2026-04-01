import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { Kanban } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sales pipeline page.
 *
 * Shows a Kanban-style board with deal stages.
 *
 * TODO: connect to a real `deals` or `pipeline_items` table once
 * the CRM schema is added to packages/db. Currently renders a
 * stage scaffold with empty columns.
 */
export default async function PipelinePage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // TODO: query deals table when CRM schema lands
  // const { data: deals } = await supabase
  //   .from("deals")
  //   .select("id, title, value_cents, stage, contact_id, created_at")
  //   .eq("business_id", businessId);

  const stages: Stage[] = [
    { id: "lead", label: "Lead", color: "bg-slate-100 border-slate-200" },
    { id: "qualified", label: "Qualified", color: "bg-blue-50 border-blue-200" },
    { id: "proposal", label: "Proposal", color: "bg-violet-50 border-violet-200" },
    { id: "negotiation", label: "Negotiation", color: "bg-amber-50 border-amber-200" },
    { id: "closed_won", label: "Closed Won", color: "bg-green-50 border-green-200" },
  ];

  // Stub: no deals yet
  const dealsByStage: Record<string, StubDeal[]> = {};
  for (const stage of stages) {
    dealsByStage[stage.id] = [];
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Sales pipeline and deal tracking
          </p>
        </div>
        <button
          disabled
          className="cursor-not-allowed rounded-md bg-primary/50 px-4 py-2 text-sm font-medium text-primary-foreground"
          title="Coming soon"
        >
          Add deal
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage[stage.id] ?? []}
          />
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Types and sub-components
// --------------------------------------------------------------------------

type Stage = {
  id: string;
  label: string;
  color: string;
};

type StubDeal = {
  id: string;
  title: string;
  value_cents: number;
  contact_name: string | null;
};

function KanbanColumn({
  stage,
  deals,
}: {
  stage: Stage;
  deals: StubDeal[];
}) {
  return (
    <div
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-lg border p-3",
        stage.color,
      )}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{stage.label}</span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {deals.length}
        </span>
      </div>

      {/* Deal cards */}
      <div className="flex-1 space-y-2">
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-8 text-center">
            <Kanban className="size-5 text-muted-foreground/40" />
            <p className="mt-1 text-xs text-muted-foreground">No deals</p>
          </div>
        ) : (
          deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: StubDeal }) {
  const value =
    deal.value_cents > 0
      ? `$${(deal.value_cents / 100).toLocaleString()}`
      : null;

  return (
    <div className="rounded-md border bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-sm font-medium">{deal.title}</p>
      {deal.contact_name && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {deal.contact_name}
        </p>
      )}
      {value && (
        <p className="mt-1 text-xs font-semibold text-green-700">{value}</p>
      )}
    </div>
  );
}
