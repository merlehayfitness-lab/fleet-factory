/**
 * Types for R&D Council autonomous sessions.
 */

export interface CouncilAgent {
  name: string;
  model: string;
  provider: string;
  role: string;
  strengths: string[];
}

export interface CouncilSession {
  id: string;
  sessionType: "scheduled" | "ad_hoc" | "emergency";
  proposer: CouncilAgent;
  participants: CouncilAgent[];
  topic: string;
  context: CouncilContext;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
}

export interface CouncilContext {
  activeProductLinks?: string[];
  currentBuildPhase?: string;
  previousMemoId?: string;
  previousMemoSummary?: string;
  customContext?: string;
}

export interface CouncilVote {
  agent: string;
  vote: "approve" | "reject" | "abstain";
  reasoning: string;
}

export interface CouncilMemo {
  sessionId: string;
  businessId?: string;
  title: string;
  summary: string;
  content: string;
  proposerAgent: string;
  participants: Array<{ agent: string; model: string; role: string }>;
  votes: Record<string, CouncilVote>;
  tags: string[];
  contextRefs: Record<string, unknown>;
}

export interface ScheduleConfig {
  times: string[]; // e.g. ["09:00", "17:00"]
  timezone: string;
  jitterMinutes: number;
  enabled: boolean;
}

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  times: ["09:00", "17:00"],
  timezone: "America/New_York",
  jitterMinutes: 15,
  enabled: true,
};

export const COUNCIL_AGENTS: CouncilAgent[] = [
  {
    name: "R&D Lead (Claude)",
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    role: "lead",
    strengths: ["reasoning", "code analysis", "technical writing", "risk assessment"],
  },
  {
    name: "R&D Analyst (GPT-4)",
    model: "gpt-4o",
    provider: "openai",
    role: "analyst",
    strengths: ["data analysis", "creative ideation", "knowledge synthesis", "structured output"],
  },
  {
    name: "R&D Strategist (Gemini)",
    model: "gemini-2.0-flash",
    provider: "google",
    role: "strategist",
    strengths: ["multimodal analysis", "web search", "long-context processing", "real-time data"],
  },
  {
    name: "R&D Engineer (Mistral)",
    model: "mistral-large-latest",
    provider: "mistral",
    role: "engineer",
    strengths: ["code generation", "optimization", "benchmarking", "rapid prototyping"],
  },
  {
    name: "R&D Researcher (DeepSeek)",
    model: "deepseek-chat",
    provider: "deepseek",
    role: "researcher",
    strengths: ["deep research", "mathematical reasoning", "formal verification", "algorithms"],
  },
];
