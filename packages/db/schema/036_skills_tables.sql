-- ====== 036: Skills, Skill Assignments, and Skill Templates ======

-- 1. Skills table (per-tenant skill entities with soft delete)
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content text NOT NULL,
  trigger_phrases text[],
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'imported', 'template')),
  source_url text,
  version integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skills_business
  ON public.skills (business_id);
CREATE INDEX IF NOT EXISTS idx_skills_business_name
  ON public.skills (business_id, name);

-- 2. Skill Assignments table (many-to-many with agent OR department target)
CREATE TABLE IF NOT EXISTS public.skill_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id uuid NOT NULL REFERENCES public.skills ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT skill_assignment_target CHECK (
    (agent_id IS NOT NULL AND department_id IS NULL)
    OR (agent_id IS NULL AND department_id IS NOT NULL)
  )
);

ALTER TABLE public.skill_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skill_assignments_agent
  ON public.skill_assignments (agent_id);
CREATE INDEX IF NOT EXISTS idx_skill_assignments_department
  ON public.skill_assignments (department_id);
CREATE INDEX IF NOT EXISTS idx_skill_assignments_skill
  ON public.skill_assignments (skill_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_assignments_unique_agent
  ON public.skill_assignments (skill_id, agent_id) WHERE agent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_assignments_unique_dept
  ON public.skill_assignments (skill_id, department_id) WHERE department_id IS NOT NULL;

-- 3. Skill Templates table (globally readable starter templates)
CREATE TABLE IF NOT EXISTS public.skill_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  content text NOT NULL,
  department_type text NOT NULL,
  role_type text,
  trigger_phrases text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.skill_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_skill_templates_department
  ON public.skill_templates (department_type);

-- ====== RLS Policies ======

-- Skills: SELECT for business members, INSERT/UPDATE/DELETE for owner/admin
CREATE POLICY "skills_select_member" ON public.skills
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "skills_insert_admin" ON public.skills
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "skills_update_admin" ON public.skills
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "skills_delete_admin" ON public.skills
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Skill Assignments: SELECT for members, INSERT/DELETE for owner/admin
CREATE POLICY "skill_assignments_select_member" ON public.skill_assignments
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "skill_assignments_insert_admin" ON public.skill_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

CREATE POLICY "skill_assignments_delete_admin" ON public.skill_assignments
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_business(business_id, 'owner')
    OR public.has_role_on_business(business_id, 'admin')
  );

-- Skill Templates: SELECT for all authenticated users (globally readable)
CREATE POLICY "skill_templates_select_authenticated" ON public.skill_templates
  FOR SELECT TO authenticated
  USING (true);

-- ====== Seed Starter Skill Templates (10 total) ======

-- Owner Department (2 templates)
INSERT INTO public.skill_templates (name, description, content, department_type, role_type, trigger_phrases)
VALUES
(
  'Strategic Planning',
  'Goal setting, KPI tracking, and quarterly business reviews',
  E'## Capabilities\n\n- Set and track quarterly OKRs and KPIs for the business\n- Analyze progress against strategic goals and flag deviations\n- Generate quarterly review summaries with recommendations\n- Identify growth opportunities based on performance data\n\n## Workflows\n\n1. **Goal Setting**: When asked to set goals, gather context on current metrics, propose SMART objectives, and create tracking checkpoints\n2. **KPI Monitoring**: Regularly check KPI dashboards, compare against targets, and alert on significant variances (>10% deviation)\n3. **Quarterly Review**: At quarter end, compile performance data, identify wins and misses, and draft a review document with action items\n\n## Boundaries\n\n- Do not make financial commitments or approve budgets without owner confirmation\n- Recommendations should be data-driven; flag when data is insufficient\n- Escalate strategic pivots or major goal changes to the business owner',
  'owner',
  'planning',
  ARRAY['set goals', 'track KPIs', 'quarterly review', 'strategic plan', 'OKR']
),
(
  'Team Coordination',
  'Cross-department communication and meeting facilitation',
  E'## Capabilities\n\n- Facilitate cross-department communication and alignment\n- Schedule and prepare agendas for team meetings\n- Track action items and follow up on commitments\n- Identify bottlenecks in inter-team workflows\n\n## Workflows\n\n1. **Meeting Prep**: Before scheduled meetings, compile updates from each department, draft an agenda, and share with participants\n2. **Action Tracking**: After meetings, extract action items, assign owners, set deadlines, and send follow-up reminders\n3. **Escalation**: When cross-department blockers are identified, route them to the appropriate team lead with context\n\n## Boundaries\n\n- Do not override department-specific decisions without team lead input\n- Keep meeting summaries concise and action-oriented\n- Respect individual team workflows; coordinate, do not dictate',
  'owner',
  'coordination',
  ARRAY['coordinate teams', 'meeting agenda', 'action items', 'cross-department', 'follow up']
);

-- Sales Department (3 templates)
INSERT INTO public.skill_templates (name, description, content, department_type, role_type, trigger_phrases)
VALUES
(
  'Lead Qualification',
  'Ideal customer profile matching, lead scoring, and prioritization',
  E'## Capabilities\n\n- Score inbound leads against the Ideal Customer Profile (ICP)\n- Prioritize leads by fit score, engagement level, and deal potential\n- Enrich lead data from available sources (company size, industry, role)\n- Flag high-priority leads for immediate sales follow-up\n\n## Workflows\n\n1. **Lead Scoring**: On new lead intake, evaluate against ICP criteria (industry, company size, budget, pain points). Assign a score of 1-100.\n2. **Prioritization**: Rank qualified leads by score and engagement recency. Surface the top 10 daily.\n3. **Enrichment**: For leads missing key data, attempt to fill gaps from public sources and note confidence level.\n\n## Boundaries\n\n- Do not contact leads directly; route qualified leads to the sales team\n- Scoring criteria should be reviewed monthly with the sales manager\n- Mark uncertain qualifications clearly rather than guessing',
  'sales',
  'qualification',
  ARRAY['qualify lead', 'score lead', 'ICP match', 'prioritize leads', 'lead enrichment']
),
(
  'Outreach Cadence',
  'Email sequence management, follow-up timing, and personalization',
  E'## Capabilities\n\n- Design multi-step email outreach sequences for different prospect segments\n- Personalize outreach messages based on prospect context and engagement history\n- Optimize send timing based on open rate data and prospect timezone\n- Track sequence performance and suggest A/B test variations\n\n## Workflows\n\n1. **Sequence Design**: Given a prospect segment, create a 4-6 step email cadence with appropriate spacing (Day 1, 3, 7, 14, 21)\n2. **Personalization**: Before each send, customize the template with prospect-specific details (company name, recent news, mutual connections)\n3. **Follow-up**: Monitor replies and engagement. Adjust cadence timing for engaged prospects; pause for opt-outs.\n\n## Boundaries\n\n- Respect opt-out requests immediately and permanently\n- Do not send more than one email per prospect per day\n- All outreach must comply with CAN-SPAM and GDPR guidelines\n- Flag negative responses for human review',
  'sales',
  'outreach',
  ARRAY['email sequence', 'outreach', 'follow up', 'cadence', 'personalize email']
),
(
  'Deal Management',
  'Pipeline tracking, forecasting, and close planning',
  E'## Capabilities\n\n- Track deals through pipeline stages (Prospect, Discovery, Proposal, Negotiation, Closed)\n- Forecast revenue based on pipeline stage probabilities and historical close rates\n- Identify stalled deals and suggest re-engagement strategies\n- Prepare deal briefs with key decision-maker info and competitive context\n\n## Workflows\n\n1. **Pipeline Update**: Daily, review all active deals. Flag deals that have not progressed in 7+ days.\n2. **Forecast**: Weekly, calculate weighted pipeline value and compare against quota targets.\n3. **Close Planning**: For deals in Negotiation stage, prepare a close plan with next steps, decision timeline, and risk factors.\n\n## Boundaries\n\n- Do not approve discounts or special terms without manager authorization\n- Revenue forecasts should note confidence intervals\n- Competitive intelligence must come from public sources only',
  'sales',
  'pipeline',
  ARRAY['pipeline', 'deal tracking', 'forecast', 'close plan', 'stalled deals']
);

-- Support Department (2 templates)
INSERT INTO public.skill_templates (name, description, content, department_type, role_type, trigger_phrases)
VALUES
(
  'Ticket Triage',
  'Classification, urgency assessment, and intelligent routing',
  E'## Capabilities\n\n- Classify incoming support tickets by category (bug, feature request, billing, how-to, account)\n- Assess urgency level (critical, high, normal, low) based on content and customer tier\n- Route tickets to the appropriate team member or specialist queue\n- Detect duplicate tickets and link related issues\n\n## Workflows\n\n1. **Classification**: On new ticket, analyze subject and body. Assign category and urgency within 30 seconds.\n2. **Routing**: Based on category and agent availability, assign to the best-matched support agent.\n3. **Escalation**: Auto-escalate if: customer is enterprise tier, issue mentions data loss, or ticket has been open >4 hours without response.\n\n## Boundaries\n\n- Never close a ticket without customer confirmation of resolution\n- Critical tickets must be escalated to a human agent immediately\n- Do not share internal escalation rules with customers',
  'support',
  'triage',
  ARRAY['triage ticket', 'classify issue', 'route ticket', 'urgent support', 'escalate']
),
(
  'Knowledge Base Lookup',
  'Search, answer synthesis, and documentation gap identification',
  E'## Capabilities\n\n- Search the knowledge base for relevant articles matching customer questions\n- Synthesize clear, concise answers from multiple knowledge base sources\n- Identify gaps in documentation and suggest new articles to create\n- Track frequently asked questions that are not well-covered\n\n## Workflows\n\n1. **Search & Answer**: On customer question, search KB articles. If a match is found, compose a tailored answer citing the source article.\n2. **Gap Detection**: If no relevant article is found, log the topic as a documentation gap and provide a best-effort answer.\n3. **FAQ Tracking**: Weekly, compile the top unanswered or poorly-answered questions for the content team.\n\n## Boundaries\n\n- Always cite the source article when answering from the knowledge base\n- If unsure about an answer, escalate to a human agent rather than guessing\n- Do not modify knowledge base articles directly; suggest edits through the review process',
  'support',
  'knowledge',
  ARRAY['search knowledge base', 'find answer', 'FAQ', 'documentation', 'help article']
);

-- Operations Department (3 templates)
INSERT INTO public.skill_templates (name, description, content, department_type, role_type, trigger_phrases)
VALUES
(
  'Process Automation',
  'Workflow triggers, error handling, and automated reporting',
  E'## Capabilities\n\n- Monitor workflow triggers and execute automated process steps\n- Handle errors in automated pipelines with retry logic and fallback paths\n- Generate daily and weekly operational reports from process data\n- Identify process bottlenecks and suggest optimization opportunities\n\n## Workflows\n\n1. **Trigger Monitoring**: Watch for defined trigger events. When fired, execute the associated workflow steps in sequence.\n2. **Error Handling**: On pipeline failure, attempt retry (max 3). If still failing, pause the workflow and alert the operations team.\n3. **Reporting**: At scheduled intervals, compile process metrics (completion rate, avg duration, error rate) into a formatted report.\n\n## Boundaries\n\n- Do not modify production workflows without approval from operations lead\n- Retry logic should have exponential backoff to avoid cascade failures\n- Alert on any process that exceeds 3x its normal duration',
  'operations',
  'automation',
  ARRAY['automate workflow', 'process trigger', 'error handling', 'pipeline', 'automated report']
),
(
  'Data Analysis',
  'Metrics collection, anomaly detection, and trend visualization',
  E'## Capabilities\n\n- Collect and aggregate operational metrics from multiple data sources\n- Detect anomalies in time-series data using statistical thresholds\n- Generate trend analysis reports with visualizations and insights\n- Build and maintain dashboards for key operational KPIs\n\n## Workflows\n\n1. **Metric Collection**: Hourly, pull metrics from configured data sources. Store in the analysis pipeline.\n2. **Anomaly Detection**: Compare each metric against its rolling 30-day average. Flag values beyond 2 standard deviations.\n3. **Trend Reports**: Weekly, generate trend summaries highlighting notable changes, correlations, and forecasts.\n\n## Boundaries\n\n- Data access must respect tenant isolation; never mix data across businesses\n- Anomaly alerts should include context (what changed, possible causes)\n- Do not take automated action on anomalies; alert the team for investigation',
  'operations',
  'analysis',
  ARRAY['analyze data', 'detect anomaly', 'metrics report', 'trend analysis', 'dashboard']
),
(
  'Resource Scheduling',
  'Calendar management, capacity planning, and workload balancing',
  E'## Capabilities\n\n- Manage team calendars and schedule meetings based on availability\n- Track team capacity and workload across projects\n- Balance resource allocation to prevent over- or under-utilization\n- Forecast resource needs based on upcoming project timelines\n\n## Workflows\n\n1. **Scheduling**: When a meeting or task needs scheduling, check team availability and propose the earliest suitable slot.\n2. **Capacity Check**: Daily, calculate team utilization rates. Flag individuals above 90% or below 40% utilization.\n3. **Forecasting**: Based on project timelines and current allocation, predict resource shortfalls 2 weeks ahead.\n\n## Boundaries\n\n- Respect team member time-off and blocked calendar slots\n- Do not overbook resources beyond 100% capacity without manager approval\n- Scheduling changes to client-facing meetings require confirmation',
  'operations',
  'scheduling',
  ARRAY['schedule meeting', 'capacity planning', 'resource allocation', 'workload balance', 'calendar']
);

-- 036b: Add import_collection column for grouping imported skills by repo name
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS import_collection text;
CREATE INDEX IF NOT EXISTS idx_skills_import_collection
  ON public.skills (business_id, import_collection) WHERE import_collection IS NOT NULL;
