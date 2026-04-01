-- 044: Port allocations table
-- Manages port block assignments for VPS tenant containers.
-- Each business gets a block of 100 ports starting at 4000.

CREATE TABLE IF NOT EXISTS public.port_allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  port_range_start integer NOT NULL,
  port_range_end integer NOT NULL,
  allocated_at timestamptz DEFAULT now() NOT NULL,
  released_at timestamptz,
  UNIQUE(business_id),
  CHECK (port_range_end > port_range_start),
  CHECK (port_range_start >= 4000)
);

ALTER TABLE public.port_allocations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_port_allocations_business
  ON public.port_allocations (business_id);

CREATE INDEX IF NOT EXISTS idx_port_allocations_range
  ON public.port_allocations (port_range_start, port_range_end);

-- RLS: business members can view their port allocation
CREATE POLICY "port_allocations_select_member"
  ON public.port_allocations FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

-- Helper function to allocate the next available port block
CREATE OR REPLACE FUNCTION public.allocate_port_block(p_business_id uuid)
RETURNS public.port_allocations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_start integer;
  v_result public.port_allocations;
BEGIN
  -- Check if business already has an allocation
  SELECT * INTO v_result
  FROM public.port_allocations
  WHERE business_id = p_business_id AND released_at IS NULL;

  IF FOUND THEN
    RETURN v_result;
  END IF;

  -- Find the next available block (blocks of 100, starting at 4000)
  SELECT COALESCE(MAX(port_range_end), 3999) + 1
  INTO v_next_start
  FROM public.port_allocations
  WHERE released_at IS NULL;

  -- Ensure we start at minimum 4000
  IF v_next_start < 4000 THEN
    v_next_start := 4000;
  END IF;

  INSERT INTO public.port_allocations (business_id, port_range_start, port_range_end)
  VALUES (p_business_id, v_next_start, v_next_start + 99)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
