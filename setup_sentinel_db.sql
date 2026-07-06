-- Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the sentinel_events table
CREATE TABLE IF NOT EXISTS sentinel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url TEXT UNIQUE NOT NULL,
    headline TEXT NOT NULL,
    full_text TEXT,
    country_code CHAR(2),
    region TEXT,
    city TEXT,
    lat FLOAT,
    lng FLOAT,
    event_type TEXT,
    cameo_code TEXT,
    severity SMALLINT,
    tone FLOAT,
    sentiment_score FLOAT,
    source_credibility FLOAT,
    language VARCHAR(50),
    image_url TEXT,
    ai_analysis JSONB DEFAULT '{}'::jsonb,
    raw_gdelt JSONB,
    embedding vector(768),
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.country_metadata (
    iso2_code text PRIMARY KEY,
    country_name text NOT NULL,
    imf_gdp_growth numeric,
    imf_inflation_rate numeric,
    imf_current_account_balance numeric,
    imf_gov_gross_debt numeric,
    wb_lpi_score numeric,
    wb_cpia_score numeric,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    fred_fx_series_id text,
    fred_currency_volatility numeric,
    fred_interest_rate numeric,
    fred_cpi numeric
);

ALTER TABLE public.country_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to country metadata" 
    ON public.country_metadata FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to country metadata" 
    ON public.country_metadata USING (true) WITH CHECK (true);

-- Ensure schema cache is updated
NOTIFY pgrst, 'reload schema';
