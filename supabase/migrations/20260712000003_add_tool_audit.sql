-- ─── sentinel_tool_audit ──────────────────────────────────────────────────────
-- Logs every external tool call (web search) made by the Intel Chat LLM.
-- This gives enterprise clients full visibility into what queries were sent
-- to external search providers (Tavily / Serper) on their behalf.
--
-- SECURITY DESIGN:
-- - BYOD org event content is NEVER sent to search providers.
-- - Only the LLM-generated search query string (a short text) is sent.
-- - This table lets admins audit exactly what search queries were generated.

CREATE TABLE IF NOT EXISTS sentinel_tool_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,                     -- NULL for platform/public users
  user_id         UUID,                     -- Supabase auth user ID
  session_id      TEXT,                     -- Langfuse trace ID for correlation

  -- Tool metadata
  tool_name       TEXT NOT NULL,            -- e.g. 'search_web'
  tool_input      JSONB NOT NULL,           -- The exact arguments sent (e.g. { query: "...", reason: "..." })
  tool_provider   TEXT,                     -- 'tavily' | 'serper' | 'none'

  -- Result metadata (no full results stored — just stats)
  result_count    INTEGER,                  -- How many results were returned
  latency_ms      INTEGER,                  -- How long the search took
  succeeded       BOOLEAN NOT NULL DEFAULT TRUE,
  error_message   TEXT,                     -- NULL if succeeded

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for admin audit queries
CREATE INDEX IF NOT EXISTS tool_audit_org_idx ON sentinel_tool_audit (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tool_audit_user_idx ON sentinel_tool_audit (user_id, created_at DESC);

-- RLS: org admins can see their own org's audit log
ALTER TABLE sentinel_tool_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_tool_audit_select" ON sentinel_tool_audit
  FOR SELECT
  USING (
    organization_id IS NULL OR
    organization_id::text = (auth.jwt() ->> 'organization_id')
  );

-- Service role can insert (Edge Functions use service role)
CREATE POLICY "service_tool_audit_insert" ON sentinel_tool_audit
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE sentinel_tool_audit IS
  'Immutable audit log of all external tool calls (web searches) made by Sentinel Intel Chat LLM. Enables enterprise compliance review of what queries were sent to external search providers.';

-- ─── org_web_search_settings ──────────────────────────────────────────────────
-- Per-org opt-in/opt-out for web search tool calling.
-- Web search is DISABLED by default for all orgs with BYOD data.
-- Orgs must explicitly enable it after reviewing the data flow implications.

CREATE TABLE IF NOT EXISTS org_web_search_settings (
  organization_id   UUID PRIMARY KEY,
  web_search_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  -- If true, LLM is additionally instructed never to include proper nouns
  -- from BYOD event content in search queries (extra sanitization layer)
  sanitize_queries    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE org_web_search_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_web_search_rw" ON org_web_search_settings
  FOR ALL
  USING (organization_id::text = (auth.jwt() ->> 'organization_id'));

COMMENT ON TABLE org_web_search_settings IS
  'Per-org web search opt-in. Disabled by default for BYOD orgs to prevent accidental leakage of private entity names via LLM-generated search queries.';
