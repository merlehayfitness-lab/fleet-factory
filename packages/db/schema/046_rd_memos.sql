-- 046: R&D Council memos table
-- Stores structured outputs from autonomous R&D council sessions.

CREATE TABLE IF NOT EXISTS public.rd_memos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL,
  business_id uuid REFERENCES public.businesses ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  proposer_agent text NOT NULL,
  participants jsonb NOT NULL DEFAULT '[]',
  votes jsonb NOT NULL DEFAULT '{}',
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  session_type text NOT NULL DEFAULT 'scheduled'
    CHECK (session_type IN ('scheduled', 'ad_hoc', 'emergency')),
  context_refs jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.rd_memos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rd_memos_session ON public.rd_memos (session_id);
CREATE INDEX IF NOT EXISTS idx_rd_memos_business ON public.rd_memos (business_id);
CREATE INDEX IF NOT EXISTS idx_rd_memos_status ON public.rd_memos (status);
CREATE INDEX IF NOT EXISTS idx_rd_memos_created ON public.rd_memos (created_at);
CREATE INDEX IF NOT EXISTS idx_rd_memos_tags ON public.rd_memos USING gin (tags);

-- RLS: business members can view memos for their business; system memos (null business_id) visible to all
CREATE POLICY "rd_memos_select_member"
  ON public.rd_memos FOR SELECT
  TO authenticated
  USING (
    business_id IS NULL
    OR public.is_business_member(business_id)
  );

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_rd_memos_updated_at ON public.rd_memos;
CREATE TRIGGER set_rd_memos_updated_at
  BEFORE UPDATE ON public.rd_memos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.rd_memos IS 'Structured memos from R&D Council autonomous sessions';
COMMENT ON COLUMN public.rd_memos.participants IS 'Array of {agent, model, role} objects';
COMMENT ON COLUMN public.rd_memos.votes IS 'Map of agent_name -> {vote: approve|reject|abstain, reasoning: text}';
COMMENT ON COLUMN public.rd_memos.context_refs IS 'References to product links, build phases, previous memos';
