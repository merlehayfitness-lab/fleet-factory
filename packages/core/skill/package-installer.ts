/**
 * Skill package installer service.
 *
 * Maps skill package definitions from agent templates to install commands
 * for VPS deployment. Generates the commands that provision-tenant.sh
 * runs inside agent containers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillPackageRef {
  name: string;
  source: "builtin" | "npm" | "github" | "url";
  version?: string;
  url?: string;
}

export interface InstallCommand {
  packageName: string;
  command: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Builtin skill registry
// ---------------------------------------------------------------------------

/**
 * Builtin skills are resolved to pre-installed modules in the agent container.
 * No install command needed — they're available via the agent runtime.
 */
const BUILTIN_SKILLS: Record<string, { description: string; module: string }> = {
  // CEO
  "agent-orchestrator": { description: "Orchestrate and delegate to sub-agents", module: "@af/skill-orchestrator" },
  "kpi-tracker": { description: "Track and report KPIs across departments", module: "@af/skill-kpi" },
  // Marketing
  "analytics-reader": { description: "Read and interpret analytics data", module: "@af/skill-analytics" },
  "campaign-planner": { description: "Plan marketing campaigns", module: "@af/skill-campaign" },
  "content-generator": { description: "Generate content drafts", module: "@af/skill-content" },
  "grammar-checker": { description: "Check grammar and style", module: "@af/skill-grammar" },
  "keyword-researcher": { description: "Research keywords and search trends", module: "@af/skill-keywords" },
  "site-auditor": { description: "Audit website SEO and performance", module: "@af/skill-audit" },
  "email-sequencer": { description: "Create email sequences", module: "@af/skill-email" },
  "prospect-finder": { description: "Find and qualify prospects", module: "@af/skill-prospect" },
  "social-scheduler": { description: "Schedule social media posts", module: "@af/skill-social" },
  "image-generator": { description: "Generate images for content", module: "@af/skill-image" },
  // Sales
  "lead-scorer": { description: "Score and qualify leads", module: "@af/skill-lead-score" },
  "crm-updater": { description: "Update CRM records", module: "@af/skill-crm-update" },
  "proposal-generator": { description: "Generate sales proposals", module: "@af/skill-proposal" },
  "pricing-calculator": { description: "Calculate pricing and quotes", module: "@af/skill-pricing" },
  "crm-hygiene": { description: "CRM data cleanup and validation", module: "@af/skill-crm-hygiene" },
  "pipeline-reporter": { description: "Generate pipeline reports", module: "@af/skill-pipeline" },
  // Operations
  "task-planner": { description: "Plan and decompose tasks", module: "@af/skill-task-plan" },
  "capacity-tracker": { description: "Track team capacity", module: "@af/skill-capacity" },
  "calendar-manager": { description: "Manage calendars and scheduling", module: "@af/skill-calendar" },
  "reminder-service": { description: "Set and manage reminders", module: "@af/skill-reminder" },
  "data-aggregator": { description: "Aggregate data from multiple sources", module: "@af/skill-data-agg" },
  "chart-generator": { description: "Generate charts and visualizations", module: "@af/skill-charts" },
  // Support
  "ticket-responder": { description: "Respond to support tickets", module: "@af/skill-ticket" },
  "kb-searcher": { description: "Search knowledge base", module: "@af/skill-kb-search" },
  "kb-writer": { description: "Write knowledge base articles", module: "@af/skill-kb-write" },
  "ticket-analyzer": { description: "Analyze ticket patterns", module: "@af/skill-ticket-analyze" },
  "escalation-handler": { description: "Handle escalated issues", module: "@af/skill-escalation" },
  "incident-reporter": { description: "Create incident reports", module: "@af/skill-incident" },
  // R&D
  "code-analyzer": { description: "Analyze code quality and patterns", module: "@af/skill-code-analyze" },
  "research-writer": { description: "Write research documents", module: "@af/skill-research" },
  "data-analyzer": { description: "Analyze datasets", module: "@af/skill-data-analyze" },
  "ideation-engine": { description: "Generate and evaluate ideas", module: "@af/skill-ideation" },
  "web-researcher": { description: "Research topics via web", module: "@af/skill-web-research" },
  "multimodal-analyzer": { description: "Analyze multimodal content", module: "@af/skill-multimodal" },
  "code-generator": { description: "Generate code from specs", module: "@af/skill-code-gen" },
  "benchmark-runner": { description: "Run performance benchmarks", module: "@af/skill-benchmark" },
  "research-engine": { description: "Deep research with citations", module: "@af/skill-deep-research" },
  "math-solver": { description: "Solve mathematical problems", module: "@af/skill-math" },
};

// ---------------------------------------------------------------------------
// Install command generation
// ---------------------------------------------------------------------------

/**
 * Generate install commands for a set of skill packages.
 */
export function generateInstallCommands(packages: SkillPackageRef[]): InstallCommand[] {
  const commands: InstallCommand[] = [];

  for (const pkg of packages) {
    switch (pkg.source) {
      case "builtin": {
        const builtin = BUILTIN_SKILLS[pkg.name];
        if (builtin) {
          // Builtins are pre-installed, but we still emit a "verify" command
          commands.push({
            packageName: pkg.name,
            command: `echo "Builtin skill available: ${builtin.module}"`,
            description: builtin.description,
          });
        }
        break;
      }
      case "npm":
        commands.push({
          packageName: pkg.name,
          command: `npm install ${pkg.name}${pkg.version ? `@${pkg.version}` : ""}`,
          description: `Install npm package: ${pkg.name}`,
        });
        break;
      case "github":
        commands.push({
          packageName: pkg.name,
          command: `npm install ${pkg.url ?? pkg.name}`,
          description: `Install from GitHub: ${pkg.url ?? pkg.name}`,
        });
        break;
      case "url":
        commands.push({
          packageName: pkg.name,
          command: `curl -sSL "${pkg.url}" -o /skills/${pkg.name}.js`,
          description: `Download skill from URL: ${pkg.name}`,
        });
        break;
    }
  }

  return commands;
}

/**
 * Get the builtin skill definition for a skill name.
 */
export function getBuiltinSkill(name: string): { description: string; module: string } | null {
  return BUILTIN_SKILLS[name] ?? null;
}

/**
 * List all available builtin skills.
 */
export function listBuiltinSkills(): Array<{ name: string; description: string; module: string }> {
  return Object.entries(BUILTIN_SKILLS).map(([name, info]) => ({
    name,
    ...info,
  }));
}

/**
 * Generate a shell script that installs all skill packages for an agent.
 * Used by provision-tenant.sh to set up agent containers.
 */
export function generateInstallScript(packages: SkillPackageRef[]): string {
  const commands = generateInstallCommands(packages);
  if (commands.length === 0) return "# No skill packages to install\n";

  const lines = [
    "#!/bin/bash",
    "# Auto-generated skill package installer",
    "set -euo pipefail",
    "",
  ];

  for (const cmd of commands) {
    lines.push(`# ${cmd.description}`);
    lines.push(cmd.command);
    lines.push("");
  }

  return lines.join("\n");
}
