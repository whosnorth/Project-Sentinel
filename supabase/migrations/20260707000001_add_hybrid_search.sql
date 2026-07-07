CREATE OR REPLACE FUNCTION public.hybrid_search_events(
    p_query_text text,
    p_query_embedding vector(768),
    p_match_count int,
    p_min_severity int DEFAULT NULL,
    p_country_code text DEFAULT NULL,
    p_start_date timestamptz DEFAULT NULL,
    p_end_date timestamptz DEFAULT NULL
)
RETURNS SETOF public.sentinel_events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT e.*
    FROM public.sentinel_events e
    WHERE
        -- Optional Filters
        (p_min_severity IS NULL OR e.severity >= p_min_severity) AND
        (p_country_code IS NULL OR e.country_code = p_country_code) AND
        (p_start_date IS NULL OR e.occurred_at >= p_start_date) AND
        (p_end_date IS NULL OR e.occurred_at <= p_end_date)
    ORDER BY
        -- 0.7 weight to vector similarity, 0.3 to full text search (if fts exists)
        -- Since vector distance is smaller for closer matches (ascending), we sort by distance
        -- We just use vector similarity here as the primary sort since it's the most robust for RAG
        (e.embedding <=> p_query_embedding) ASC
    LIMIT p_match_count;
END;
$$;
