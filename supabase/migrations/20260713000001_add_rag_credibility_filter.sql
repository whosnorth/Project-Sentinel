-- Migration: Add source credibility + source_url to hybrid_search_events RPC
-- This enables the chat query to enforce an institutional source quality floor
-- at query time without any re-ingestion of existing events.
--
-- Changes:
--   1. Adds p_min_credibility parameter (default 0.0 = no filter)
--   2. Adds source_url and source_credibility to the returned columns
--   3. The WHERE clause filters out events below the credibility threshold

DROP FUNCTION IF EXISTS hybrid_search_events(text, vector, integer, text, date, date, integer, uuid);

CREATE OR REPLACE FUNCTION hybrid_search_events(
  p_query_text       text,
  p_query_embedding  vector(768),
  p_match_count      int     DEFAULT 10,
  p_country_code     text    DEFAULT NULL,
  p_start_date       date    DEFAULT NULL,
  p_end_date         date    DEFAULT NULL,
  p_min_severity     int     DEFAULT NULL,
  p_organization_id  uuid    DEFAULT NULL,
  p_min_credibility  float   DEFAULT 0.0
)
RETURNS TABLE (
  id                 uuid,
  headline           text,
  event_type         text,
  occurred_at        timestamptz,
  country_code       char(2),
  severity           smallint,
  full_text          text,
  ai_analysis        jsonb,
  is_proprietary     boolean,
  source_url         text,
  source_credibility float,
  similarity         double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.headline,
    e.event_type,
    e.occurred_at,
    e.country_code,
    e.severity,
    e.full_text,
    e.ai_analysis,
    e.is_proprietary,
    e.source_url,
    e.source_credibility,
    (e.embedding <#> p_query_embedding) * -1 AS similarity
  FROM sentinel_events e
  WHERE
    (p_query_text IS NULL OR to_tsvector('english', e.headline || ' ' || coalesce(e.full_text, '')) @@ websearch_to_tsquery('english', p_query_text))
    AND (p_country_code IS NULL OR e.country_code = p_country_code)
    AND (p_start_date IS NULL OR e.occurred_at >= p_start_date)
    AND (p_end_date IS NULL OR e.occurred_at <= p_end_date)
    AND (p_min_severity IS NULL OR e.severity >= p_min_severity)
    AND (e.organization_id IS NULL OR e.organization_id = p_organization_id)
    -- Source credibility floor: 0.0 = no filter, 0.6 = Tier-2+ only, 0.9 = Tier-1 only
    AND (p_min_credibility = 0.0 OR coalesce(e.source_credibility, 0.0) >= p_min_credibility)
  ORDER BY similarity DESC
  LIMIT p_match_count;
END;
$$;
