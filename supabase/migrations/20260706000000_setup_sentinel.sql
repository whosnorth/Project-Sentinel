-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── sentinel_events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentinel_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source metadata
  source_url      TEXT,
  headline        TEXT NOT NULL,
  full_text       TEXT,
  
  -- Geography
  country_code    CHAR(2),
  region          TEXT,
  city            TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  
  -- Classification
  event_type      TEXT,
  cameo_code      TEXT,
  severity        SMALLINT CHECK (severity BETWEEN 1 AND 10),
  
  -- AI reasoning output
  ai_analysis     JSONB,
  
  -- RAG vector (768-dim for text-embedding-004)
  embedding       VECTOR(768),
  
  -- Raw GDELT payload
  raw_gdelt       JSONB,
  
  -- Timestamps
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── risk_scores (Used by SentinelDashboard.tsx) ─────────────────────────────
CREATE TABLE IF NOT EXISTS risk_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code    CHAR(2)  NOT NULL,
  score           NUMERIC(5,2) NOT NULL,
  security_score  NUMERIC(5,2),
  economy_score   NUMERIC(5,2),
  social_score    NUMERIC(5,2),
  breakdown       JSONB,
  event_count     INTEGER DEFAULT 0,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS sentinel_events_country_idx  ON sentinel_events (country_code);
CREATE INDEX IF NOT EXISTS sentinel_events_occurred_idx ON sentinel_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS sentinel_events_type_idx     ON sentinel_events (event_type);
CREATE INDEX IF NOT EXISTS sentinel_events_latlong_idx  ON sentinel_events (lat, lng);

-- Vector similarity index for RAG lookups
CREATE INDEX IF NOT EXISTS sentinel_events_embedding_idx
  ON sentinel_events USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS risk_scores_country_idx
  ON risk_scores (country_code, calculated_at DESC);

-- ─── Realtime ──────────────────────────────────────────────────────────────────
-- Allow Supabase Realtime to broadcast new sentinel events to connected clients.
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE sentinel_events;
ALTER PUBLICATION supabase_realtime ADD TABLE risk_scores;

-- ─── RPC: get_event_timeline_bins ──────────────────────────────────────────────
-- Returns hourly histogram of events for the timeline bar
CREATE OR REPLACE FUNCTION get_event_timeline_bins(p_country_code TEXT DEFAULT NULL, p_hours INTEGER DEFAULT 24)
RETURNS TABLE (hour_label TEXT, event_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH hours AS (
    SELECT generate_series(
      date_trunc('hour', now() - (p_hours || ' hours')::interval),
      date_trunc('hour', now()),
      interval '1 hour'
    ) AS h
  )
  SELECT 
    to_char(h.h, 'HH24:MI') as hour_label,
    COUNT(se.id) as event_count
  FROM hours h
  LEFT JOIN sentinel_events se 
    ON date_trunc('hour', se.occurred_at) = h.h
    AND (p_country_code IS NULL OR se.country_code = p_country_code)
  GROUP BY h.h
  ORDER BY h.h DESC;
END;
$$ LANGUAGE plpgsql;

-- ─── RPC: get_event_graph_json ─────────────────────────────────────────────────
-- Renders the AI correlation graph relationships
CREATE OR REPLACE FUNCTION get_event_graph_json(p_event_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Stub implementation for hackathon scaffolding until the AI graph backend is connected
  RETURN jsonb_build_object(
    'nodes', '[]'::jsonb,
    'edges', '[]'::jsonb
  );
END;
$$ LANGUAGE plpgsql;

-- ─── Disable RLS for Hackathon Demo UI (Public Read Access) ────────────────────
ALTER TABLE sentinel_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores DISABLE ROW LEVEL SECURITY;
