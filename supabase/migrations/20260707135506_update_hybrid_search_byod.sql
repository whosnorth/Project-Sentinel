-- Update hybrid_search_events to support tenant isolation (BYOD)

DROP FUNCTION IF EXISTS hybrid_search_events(text, vector, integer, text, date, date, integer);

CREATE OR REPLACE FUNCTION hybrid_search_events(
  p_query_text text,
  p_query_embedding vector(768),
  p_match_count int DEFAULT 10,
  p_country_code text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_min_severity int DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  gdelt_id text,
  headline text,
  event_type text,
  occurred_at timestamptz,
  country_code text,
  severity int,
  full_text text,
  ai_analysis jsonb,
  is_proprietary boolean,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.gdelt_id,
    e.headline,
    e.event_type,
    e.occurred_at,
    e.country_code,
    e.severity,
    e.full_text,
    e.ai_analysis,
    e.is_proprietary,
    (e.embedding <#> p_query_embedding) * -1 AS similarity
  FROM sentinel_events e
  WHERE
    (p_query_text IS NULL OR e.fts @@ websearch_to_tsquery('english', p_query_text))
    AND (p_country_code IS NULL OR e.country_code = p_country_code)
    AND (p_start_date IS NULL OR e.occurred_at >= p_start_date)
    AND (p_end_date IS NULL OR e.occurred_at <= p_end_date)
    AND (p_min_severity IS NULL OR e.severity >= p_min_severity)
    AND (e.organization_id IS NULL OR e.organization_id = p_organization_id)
  ORDER BY similarity DESC
  LIMIT p_match_count;
END;
$$;
