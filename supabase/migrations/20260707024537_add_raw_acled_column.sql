ALTER TABLE sentinel_events ADD COLUMN IF NOT EXISTS raw_acled JSONB;
NOTIFY pgrst, 'reload schema';
