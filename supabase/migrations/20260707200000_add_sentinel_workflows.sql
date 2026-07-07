CREATE TABLE IF NOT EXISTS public.sentinel_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NULL,
    name TEXT NOT NULL,
    description TEXT,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.sentinel_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's workflows"
    ON public.sentinel_workflows
    FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can insert workflows for their organization"
    ON public.sentinel_workflows
    FOR INSERT
    WITH CHECK (tenant_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can update their organization's workflows"
    ON public.sentinel_workflows
    FOR UPDATE
    USING (tenant_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can delete their organization's workflows"
    ON public.sentinel_workflows
    FOR DELETE
    USING (tenant_id = (auth.jwt() ->> 'organization_id')::UUID);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sentinel_workflows_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_sentinel_workflows_updated_at
    BEFORE UPDATE ON public.sentinel_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_sentinel_workflows_timestamp();
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.execute_sentinel_workflow_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function using pg_net
  PERFORM net.http_post(
      url := 'https://vtsknomkfvjvusrialar.supabase.co/functions/v1/execute-sentinel-workflows',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := row_to_json(NEW)::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_sentinel_event_insert ON public.sentinel_events;

-- Create trigger on sentinel_events
CREATE TRIGGER on_sentinel_event_insert
AFTER INSERT ON public.sentinel_events
FOR EACH ROW EXECUTE FUNCTION public.execute_sentinel_workflow_trigger();
-- Phase 1: Workflow execution log table
-- One row per workflow that fires per event, stores full action results.

CREATE TABLE IF NOT EXISTS public.sentinel_workflow_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID REFERENCES public.sentinel_workflows(id) ON DELETE CASCADE,
  tenant_id         UUID NULL,
  trigger_event_id  UUID,                    -- which sentinel_event fired this
  trigger_label     TEXT,                    -- e.g. 'Geospatial Event Detected'
  actions_executed  JSONB DEFAULT '[]'::jsonb, -- [{label, status, detail, ...}]
  status            TEXT DEFAULT 'success',  -- 'success' | 'partial' | 'error'
  error_message     TEXT,
  executed_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sentinel_workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their run logs"
  ON public.sentinel_workflow_runs FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Service role can insert run logs"
  ON public.sentinel_workflow_runs FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant
  ON public.sentinel_workflow_runs(tenant_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow
  ON public.sentinel_workflow_runs(workflow_id, executed_at DESC);
-- Phase 2: Auto-invoke execute-sentinel-workflows on every new sentinel_events INSERT
-- Uses pg_net to fire an async HTTP POST to the edge function.

-- Enable pg_net extension (idempotent — safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: fires HTTP POST to execute-sentinel-workflows on each new event
CREATE OR REPLACE FUNCTION notify_workflow_engine()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _project_url  TEXT;
  _service_key  TEXT;
BEGIN
  -- Read project URL and service key from Postgres config parameters.
  -- These are set by Supabase automatically as pg config vars.
  BEGIN
    _project_url := current_setting('app.settings.supabase_url');
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: try the SUPABASE_URL env var style
    BEGIN
      _project_url := current_setting('app.supabase_url');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_workflow_engine: could not read supabase_url config, skipping';
      RETURN NEW;
    END;
  END;

  BEGIN
    _service_key := current_setting('app.settings.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      _service_key := current_setting('app.service_role_key');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_workflow_engine: could not read service_role_key config, skipping';
      RETURN NEW;
    END;
  END;

  -- Fire-and-forget async HTTP POST via pg_net
  PERFORM extensions.net.http_post(
    url     := _project_url || '/functions/v1/execute-sentinel-workflows',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || _service_key
               ),
    body    := jsonb_build_object(
                 'type',   'INSERT',
                 'table',  'sentinel_events',
                 'record', row_to_json(NEW)::jsonb
               )::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert even if the HTTP call fails
  RAISE WARNING 'notify_workflow_engine: HTTP call failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Attach the trigger to sentinel_events (idempotent — drop first if it exists)
DROP TRIGGER IF EXISTS on_sentinel_event_insert ON public.sentinel_events;

CREATE TRIGGER on_sentinel_event_insert
  AFTER INSERT ON public.sentinel_events
  FOR EACH ROW EXECUTE FUNCTION notify_workflow_engine();
