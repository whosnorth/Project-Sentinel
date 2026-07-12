-- ─── organization_llm_configs ─────────────────────────────────────────────────
-- Allows each organization to configure their own LLM provider per role.
-- Supports: cloud providers (OpenAI, Anthropic, Azure, Fireworks) and
-- air-gapped / self-hosted endpoints with optional authentication.
--
-- SECURITY: API keys are stored as a reference to Supabase Vault secrets.
-- For self-hosted / private network endpoints, api_key_secret_id can be NULL
-- (no-auth mode), allowing the endpoint URL to be called directly.

CREATE TABLE IF NOT EXISTS organization_llm_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,

  -- Which inference role this config applies to
  -- 'router'    = Traffic Cop (fast, cheap classification)
  -- 'analyst'   = Deep analysis LLM (powerful, expensive)
  -- 'embedding' = Embedding model (dimension-locked per org)
  role                TEXT NOT NULL CHECK (role IN ('analyst', 'router', 'embedding')),

  -- Human-readable provider label (display only)
  provider_name       TEXT NOT NULL DEFAULT 'fireworks',

  -- The model identifier passed directly to the API
  model_id            TEXT NOT NULL,

  -- OpenAI-compatible base URL (without trailing slash)
  -- For self-hosted: e.g. 'http://192.168.1.100:8080/v1'
  -- For Azure: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}'
  api_base_url        TEXT NOT NULL DEFAULT 'https://api.fireworks.ai/inference/v1',

  -- Vault secret ID for the API key.
  -- NULL = no authentication required (air-gapped / private network mode).
  api_key_secret_id   UUID DEFAULT NULL,

  -- Optional model parameter overrides
  temperature         NUMERIC(3,2) DEFAULT 0.3,
  max_tokens          INTEGER DEFAULT 32000,

  -- For embedding models: the vector dimension of this model's output.
  -- CRITICAL: This must match the vector column dimension in sentinel_events.
  -- Changing this requires a full re-embedding migration.
  embedding_dimension INTEGER DEFAULT 768,

  -- Whether this config is actively used
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active config per (org, role) pair
  UNIQUE (organization_id, role)
);

-- ─── Trigger: auto-update updated_at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_llm_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER llm_configs_updated_at
  BEFORE UPDATE ON organization_llm_configs
  FOR EACH ROW EXECUTE FUNCTION update_llm_config_timestamp();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE organization_llm_configs ENABLE ROW LEVEL SECURITY;

-- Org members can read their own configs
CREATE POLICY "org_llm_configs_select" ON organization_llm_configs
  FOR SELECT
  USING (organization_id::text = (auth.jwt() ->> 'organization_id'));

-- Only org admins can insert/update/delete
-- (In practice, admin role is checked at the application layer via profiles table)
CREATE POLICY "org_llm_configs_write" ON organization_llm_configs
  FOR ALL
  USING (organization_id::text = (auth.jwt() ->> 'organization_id'));

-- ─── Seed: Default Fireworks platform configs ──────────────────────────────────
-- These are the fallback values used when an org has no custom config.
-- They are inserted at the platform org level (org 00000...001) for reference only.
-- Individual orgs override by inserting their own row.
COMMENT ON TABLE organization_llm_configs IS
  'Per-organization LLM provider configuration. Supports cloud and air-gapped self-hosted endpoints. NULL api_key_secret_id = no-auth mode for private networks.';
