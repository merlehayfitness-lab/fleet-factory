/**
 * R&D Council session orchestrator.
 *
 * Runs a full council session: proposer creates topic → participants debate → vote → memo.
 * Uses rate limiter for 30-second stagger between API calls.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getProposer, getParticipants } from "./council-scheduler";
import { writeMemo } from "./memo-writer";
import type {
  CouncilSession,
  CouncilContext,
  CouncilVote,
  CouncilAgent,
  CouncilMemo,
} from "./council-types";

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Run a full council session.
 *
 * Flow:
 * 1. Select proposer (round-robin based on session count)
 * 2. Proposer generates a topic/proposal
 * 3. Each participant provides feedback (30s stagger)
 * 4. All agents vote (approve/reject/abstain)
 * 5. Write structured memo to rd_memos table
 */
export async function runCouncilSession(
  supabase: SupabaseClient,
  sessionCount: number,
  context: CouncilContext,
  options?: {
    businessId?: string;
    sessionType?: "scheduled" | "ad_hoc" | "emergency";
    customTopic?: string;
  },
): Promise<CouncilMemo> {
  const sessionId = crypto.randomUUID();
  const proposer = getProposer(sessionCount);
  const participants = getParticipants(proposer);
  const sessionType = options?.sessionType ?? "scheduled";

  const session: CouncilSession = {
    id: sessionId,
    sessionType,
    proposer,
    participants,
    topic: options?.customTopic ?? "",
    context,
    startedAt: new Date().toISOString(),
    status: "running",
  };

  try {
    // Phase 1: Proposer generates topic
    const proposal = await generateProposal(proposer, context, options?.customTopic);
    session.topic = proposal.topic;

    // Phase 2: Participants discuss (30s stagger simulated via delay)
    const discussions: Array<{ agent: string; response: string }> = [];
    for (const participant of participants) {
      const response = await generateDiscussion(participant, proposal, context);
      discussions.push({ agent: participant.name, response });
      // In production, this would use the rate limiter's 30s stagger
      await sleep(100); // Reduced for non-production
    }

    // Phase 3: All agents vote
    const votes: Record<string, CouncilVote> = {};
    votes[proposer.name] = {
      agent: proposer.name,
      vote: "approve",
      reasoning: "As proposer, I support this direction.",
    };

    for (const disc of discussions) {
      // Simple heuristic: if discussion is positive, approve
      const isPositive = !disc.response.toLowerCase().includes("disagree")
        && !disc.response.toLowerCase().includes("concern");
      votes[disc.agent] = {
        agent: disc.agent,
        vote: isPositive ? "approve" : "abstain",
        reasoning: disc.response.slice(0, 200),
      };
    }

    // Phase 4: Write memo
    const memo = await writeMemo(supabase, {
      sessionId,
      businessId: options?.businessId,
      title: proposal.topic,
      summary: proposal.summary,
      content: formatMemoContent(proposal, discussions, votes),
      proposerAgent: proposer.name,
      participants: [proposer, ...participants].map((a) => ({
        agent: a.name,
        model: a.model,
        role: a.role,
      })),
      votes,
      tags: proposal.tags,
      contextRefs: context as unknown as Record<string, unknown>,
    });

    return memo;
  } catch (err) {
    // Log failure but still create a partial memo
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    const memo = await writeMemo(supabase, {
      sessionId,
      businessId: options?.businessId,
      title: `[FAILED] Council Session ${sessionCount + 1}`,
      summary: `Session failed: ${errorMsg}`,
      content: `## Session Failed\n\nError: ${errorMsg}\n\nProposer: ${proposer.name}\n`,
      proposerAgent: proposer.name,
      participants: [proposer, ...participants].map((a) => ({
        agent: a.name,
        model: a.model,
        role: a.role,
      })),
      votes: {},
      tags: ["failed"],
      contextRefs: context as unknown as Record<string, unknown>,
    });
    return memo;
  }
}

// ---------------------------------------------------------------------------
// Stub implementations (will use real LLM calls in Phase 24 runtime)
// ---------------------------------------------------------------------------

interface Proposal {
  topic: string;
  summary: string;
  details: string;
  tags: string[];
}

async function generateProposal(
  proposer: CouncilAgent,
  context: CouncilContext,
  customTopic?: string,
): Promise<Proposal> {
  // Stub: In production, this calls the proposer's model via rate-limited API
  const topic = customTopic ?? `${proposer.strengths[0]} improvement analysis`;
  return {
    topic,
    summary: `Proposal by ${proposer.name}: Analysis of ${topic} with focus on ${proposer.strengths.join(", ")}.`,
    details: `## Proposal\n\nAs ${proposer.role}, I propose we investigate ${topic}.\n\n### Context\n${context.currentBuildPhase ? `Current phase: ${context.currentBuildPhase}` : "No specific phase context."}\n\n### Approach\nLeverage ${proposer.strengths.join(", ")} to produce actionable insights.\n`,
    tags: [proposer.role, ...proposer.strengths.slice(0, 2)],
  };
}

async function generateDiscussion(
  participant: CouncilAgent,
  proposal: Proposal,
  _context: CouncilContext,
): Promise<string> {
  // Stub: In production, this calls the participant's model
  return `As ${participant.role}, I see value in "${proposal.topic}". My perspective focuses on ${participant.strengths.join(" and ")}. I suggest we also consider the implications for long-term scalability.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMemoContent(
  proposal: Proposal,
  discussions: Array<{ agent: string; response: string }>,
  votes: Record<string, CouncilVote>,
): string {
  const lines: string[] = [
    `# ${proposal.topic}`,
    "",
    "## Summary",
    proposal.summary,
    "",
    "## Proposal",
    proposal.details,
    "",
    "## Discussion",
  ];

  for (const disc of discussions) {
    lines.push(`### ${disc.agent}`);
    lines.push(disc.response);
    lines.push("");
  }

  lines.push("## Votes");
  const approves = Object.values(votes).filter((v) => v.vote === "approve").length;
  const rejects = Object.values(votes).filter((v) => v.vote === "reject").length;
  const abstains = Object.values(votes).filter((v) => v.vote === "abstain").length;
  lines.push(`Approve: ${approves} | Reject: ${rejects} | Abstain: ${abstains}`);
  lines.push("");

  for (const [agent, vote] of Object.entries(votes)) {
    lines.push(`- **${agent}**: ${vote.vote} — ${vote.reasoning}`);
  }

  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
