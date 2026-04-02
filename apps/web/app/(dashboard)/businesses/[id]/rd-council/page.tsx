import { createServerClient } from "@/_lib/supabase/server";
import { getMemos, getSessionCount, getNextSessionTime, COUNCIL_AGENTS } from "@fleet-factory/core/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function RDCouncilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const [memos, sessionCount] = await Promise.all([
    getMemos(supabase, id, { limit: 10 }),
    getSessionCount(supabase, id),
  ]);

  const nextSession = getNextSessionTime();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">R&D Council</h1>
          <p className="text-sm text-muted-foreground">
            Autonomous research sessions — 5 AI agents debating and producing memos
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground">Sessions completed</p>
          <p className="text-xl font-bold">{sessionCount}</p>
        </div>
      </div>

      {/* Council Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Council Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {COUNCIL_AGENTS.map((agent) => (
              <div key={agent.name} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.model}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {agent.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Daily sessions</p>
              <p className="font-mono text-sm">9:00 AM & 5:00 PM</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next session</p>
              <p className="font-mono text-sm">
                {nextSession.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent Memos ({memos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {memos.map((memo) => {
              const voteValues = Object.values(memo.votes) as Array<{ vote: string }>;
              const approves = voteValues.filter((v) => v.vote === "approve").length;
              const rejects = voteValues.filter((v) => v.vote === "reject").length;

              return (
                <div
                  key={memo.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{memo.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {memo.summary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">
                        {approves} approve
                      </Badge>
                      {rejects > 0 && (
                        <Badge variant="outline" className="text-red-600">
                          {rejects} reject
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Proposed by: {memo.proposerAgent}</span>
                    <span>{new Date(memo.createdAt).toLocaleDateString()}</span>
                    <div className="flex gap-1">
                      {memo.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            {memos.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No council memos yet. Sessions run automatically at scheduled times.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
