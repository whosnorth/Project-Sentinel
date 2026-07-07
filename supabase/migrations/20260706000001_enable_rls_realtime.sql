-- Enable RLS on sentinel_events and add required policies for realtime to work
ALTER TABLE public.sentinel_events ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated users to read events (required for realtime postgres_changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sentinel_events' AND policyname = 'anon_can_read_events'
  ) THEN
    CREATE POLICY anon_can_read_events
      ON public.sentinel_events
      FOR SELECT
      USING (true);
  END IF;
END
$$;

-- Allow service_role to insert/update (pollers run as service_role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sentinel_events' AND policyname = 'service_role_write_events'
  ) THEN
    CREATE POLICY service_role_write_events
      ON public.sentinel_events
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Enable RLS on sentinel_risk_scores if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sentinel_risk_scores' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.sentinel_risk_scores ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentinel_risk_scores' AND policyname = 'anon_can_read_risk_scores') THEN
      EXECUTE 'CREATE POLICY anon_can_read_risk_scores ON public.sentinel_risk_scores FOR SELECT USING (true)';
    END IF;
  END IF;
END
$$;
