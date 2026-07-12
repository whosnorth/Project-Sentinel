-- ─── organization_scoring_formulas ────────────────────────────────────────────
-- Stores per-organization custom GPR/CSI scoring formula configurations.
-- The formula_config JSONB drives ALL computation in sentinel-gpr-calculator:
--   - Framework weights (must sum to 1.0)
--   - Event-type to bucket mappings
--   - Temporal decay constant (lambda)
--   - Composite scoring method
--
-- If no active formula exists for an org, the calculator falls back to the
-- hardcoded platform defaults (backwards compatible).

CREATE TABLE IF NOT EXISTS organization_scoring_formulas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL,

  -- Display name (e.g. "Maritime Risk Profile", "Sovereign Default Focus")
  name                TEXT NOT NULL,
  description         TEXT,

  -- The formula type (reserved for future non-GPR formula types)
  formula_type        TEXT NOT NULL DEFAULT 'gpr' CHECK (formula_type IN ('gpr', 'supply_chain', 'custom')),

  -- ── The core formula definition (see schema below) ────────────────────────
  -- Schema:
  -- {
  --   "version": "1.0",
  --   "decay_lambda": 0.05,                  // per-day decay constant (0.01–0.20)
  --   "frameworks": {
  --     "fsi":   { "weight": 0.25 },         // weights MUST sum to 1.0
  --     "wgi":   { "weight": 0.25 },
  --     "acled": { "weight": 0.20 },
  --     "icrg":  { "weight": 0.20 },
  --     "gpi":   { "weight": 0.10 }
  --   },
  --   "bucket_event_map": {                  // event_type -> framework buckets
  --     "security": ["fsi_cohesion", "acled_deadliness"],
  --     "economy":  ["fsi_economic", "icrg_financial"]
  --   }
  -- }
  formula_config      JSONB NOT NULL,

  -- Whether this formula is the active one for the org's calculations
  is_active           BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (organization_id, name)
);

-- ─── Trigger: enforce only one active formula per org ─────────────────────────
CREATE OR REPLACE FUNCTION enforce_single_active_formula()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE organization_scoring_formulas
    SET is_active = FALSE
    WHERE organization_id = NEW.organization_id
      AND id != NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER single_active_formula_trigger
  BEFORE INSERT OR UPDATE ON organization_scoring_formulas
  FOR EACH ROW EXECUTE FUNCTION enforce_single_active_formula();

-- ─── Trigger: auto-update updated_at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_formula_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER formula_updated_at
  BEFORE UPDATE ON organization_scoring_formulas
  FOR EACH ROW EXECUTE FUNCTION update_formula_timestamp();

-- ─── Validation: weights must sum to 1.0 (±0.01 tolerance) ───────────────────
CREATE OR REPLACE FUNCTION validate_formula_weights()
RETURNS TRIGGER AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(
    (NEW.formula_config -> 'frameworks' -> 'fsi'   ->> 'weight')::NUMERIC, 0) +
    COALESCE((NEW.formula_config -> 'frameworks' -> 'wgi'   ->> 'weight')::NUMERIC, 0) +
    COALESCE((NEW.formula_config -> 'frameworks' -> 'acled' ->> 'weight')::NUMERIC, 0) +
    COALESCE((NEW.formula_config -> 'frameworks' -> 'icrg'  ->> 'weight')::NUMERIC, 0) +
    COALESCE((NEW.formula_config -> 'frameworks' -> 'gpi'   ->> 'weight')::NUMERIC, 0)
  INTO total;

  -- Allow ±0.01 floating point tolerance
  IF total IS NOT NULL AND (total < 0.99 OR total > 1.01) THEN
    RAISE EXCEPTION 'Formula weights must sum to 1.0 (got %). Adjust framework weights before saving.', total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER formula_weights_validation
  BEFORE INSERT OR UPDATE ON organization_scoring_formulas
  FOR EACH ROW EXECUTE FUNCTION validate_formula_weights();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE organization_scoring_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_formula_select" ON organization_scoring_formulas
  FOR SELECT
  USING (organization_id::text = (auth.jwt() ->> 'organization_id'));

CREATE POLICY "org_formula_write" ON organization_scoring_formulas
  FOR ALL
  USING (organization_id::text = (auth.jwt() ->> 'organization_id'));

COMMENT ON TABLE organization_scoring_formulas IS
  'Per-organization GPR scoring formula definitions. The active formula drives all sentinel-gpr-calculator computations for that org. Weight validation enforced at DB level.';
