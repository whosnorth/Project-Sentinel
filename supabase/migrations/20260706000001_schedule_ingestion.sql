
-- 20260623150000_schedule_gdelt_poller.sql
-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- Ensure the cron job doesn't exist before creating it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM cron.job 
    WHERE jobname = 'invoke_gdelt_poller'
  ) THEN
    PERFORM cron.unschedule('invoke_gdelt_poller');
  END IF;
END $$;

-- Create the cron job to poll every 15 minutes
SELECT cron.schedule(
  'invoke_gdelt_poller',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
        url := 'https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-gdelt-poller',
        headers := jsonb_build_object('Content-Type', 'application/json')
    );
  $$
);

-- 20260623161000_schedule_acled_poller.sql
-- Ensure pg_cron and pg_net are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- Schedule the ACLED poller to run daily at 00:00 UTC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'invoke_acled_poller'
  ) THEN
    PERFORM cron.unschedule('invoke_acled_poller');
  END IF;
END $$;

SELECT cron.schedule(
  'invoke_acled_poller',
  '0 0 * * *',
  $$
    SELECT net.http_post(
        url := 'https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-acled-poller',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);

-- 20260623200300_schedule_firms_poller.sql
-- Ensure the cron job doesn't exist before creating it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM cron.job 
    WHERE jobname = 'invoke-firms-poller'
  ) THEN
    PERFORM cron.unschedule('invoke-firms-poller');
  END IF;
END $$;

SELECT cron.schedule(
    'invoke-firms-poller',
    '0 */6 * * *', -- Every 6 hours
    $$
    SELECT net.http_post(
        url:='https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-firms-poller',
        headers:='{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
    );
    $$
);

-- 20260623200327_schedule_firms_poller.sql

-- 20260624000000_schedule_worldbank_poller.sql
-- Schedule the World Bank baseline metrics poller to run on the 1st of every month at midnight UTC.
-- World Bank structural data (LPI, GDP, Governance) updates very infrequently (quarterly/annually).
-- A monthly poll is sufficient to ensure Sentinel's context is baseline-accurate.

SELECT cron.schedule(
  'sentinel-worldbank-monthly',
  '0 0 1 * *', -- Run at 00:00 on day-of-month 1
  $$
    SELECT net.http_post(
        url:='https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-worldbank-poller',
        headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', current_setting('app.settings.service_role_key'))
    )
  $$
);

-- 20260624100000_schedule_usgs_poller.sql
-- Ensure pg_cron and pg_net are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Ensure the cron job doesn't exist before creating it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM cron.job 
    WHERE jobname = 'invoke-usgs-poller'
  ) THEN
    PERFORM cron.unschedule('invoke-usgs-poller');
  END IF;
END $$;

-- Create the cron job to poll every 15 minutes
SELECT cron.schedule(
    'invoke-usgs-poller',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url:='https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-usgs-poller',
        headers:='{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
    );
    $$
);

-- 20260624155300_schedule_imf_poller.sql
SELECT cron.schedule(
  'sentinel-imf-monthly',
  '0 0 1 * *', -- Run at 00:00 on day-of-month 1
  $$
    SELECT net.http_post(
        url:='https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-imf-poller',
        headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', current_setting('app.settings.service_role_key'))
    )
  $$
);

-- 20260624161501_schedule_fred_poller.sql
-- Schedule the FRED API Poller to run once a month at midnight UTC
-- Note: pg_cron requires the pg_cron extension, which is typically enabled in Supabase projects.

SELECT cron.schedule(
  'invoke-fred-poller',
  '0 0 1 * *', -- Run on the 1st of every month at midnight
  $$
    select net.http_post(
      url:='https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-fred-poller',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.jwt.claim.anon_key', true) || '"}'::jsonb,
      body:='{}'::jsonb
    );
  $$
);

-- 20260706000000_schedule_free_apis.sql
-- Schedule the GDACS and ReliefWeb pollers

-- Ensure pg_cron and pg_net are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- GDACS updates quickly and covers natural disasters. Run every 30 minutes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'invoke_gdacs_poller'
  ) THEN
    PERFORM cron.unschedule('invoke_gdacs_poller');
  END IF;
END $$;

SELECT cron.schedule(
  'invoke_gdacs_poller',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
        url := 'https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-gdacs-poller',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);

-- ReliefWeb compiles humanitarian reports more slowly. Run every 12 hours.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'invoke_reliefweb_poller'
  ) THEN
    PERFORM cron.unschedule('invoke_reliefweb_poller');
  END IF;
END $$;

SELECT cron.schedule(
  'invoke_reliefweb_poller',
  '0 */12 * * *',
  $$
    SELECT net.http_post(
        url := 'https://bmnrwukxkskdazwrralw.supabase.co/functions/v1/sentinel-reliefweb-poller',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);


