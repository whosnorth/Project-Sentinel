// @ts-nocheck
// One-shot migration runner — call once to enable RLS + realtime policies
// then delete this function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Only allow service role to call this
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const results: Record<string, unknown> = {};

  // Run each DDL statement via the Postgres extension
  // Edge functions with service_role can run these via supabase.rpc if we have a helper,
  // but without one, we use the raw pg connection via the internal URL
  const internalUrl = Deno.env.get("SUPABASE_DB_URL");

  if (!internalUrl) {
    // Fall back: use pg via the internal connection string
    return new Response(JSON.stringify({ 
      error: "No SUPABASE_DB_URL — run SQL manually in the Supabase Dashboard",
      sql: [
        "ALTER TABLE public.sentinel_events ENABLE ROW LEVEL SECURITY;",
        "CREATE POLICY IF NOT EXISTS anon_can_read_events ON public.sentinel_events FOR SELECT USING (true);",
        "CREATE POLICY IF NOT EXISTS service_role_write_events ON public.sentinel_events USING (true) WITH CHECK (true);"
      ]
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const client = new Client(internalUrl);
    await client.connect();

    const stmts = [
      "ALTER TABLE public.sentinel_events ENABLE ROW LEVEL SECURITY",
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sentinel_events' AND policyname='anon_can_read_events') THEN
          CREATE POLICY anon_can_read_events ON public.sentinel_events FOR SELECT USING (true);
        END IF;
      END $$`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sentinel_events' AND policyname='service_role_write_events') THEN
          CREATE POLICY service_role_write_events ON public.sentinel_events USING (true) WITH CHECK (true);
        END IF;
      END $$`,
      `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sentinel_risk_scores' AND table_schema='public') THEN
          EXECUTE 'ALTER TABLE public.sentinel_risk_scores ENABLE ROW LEVEL SECURITY';
        END IF;
      END $$`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sentinel_risk_scores' AND policyname='anon_can_read_risk_scores') THEN
          CREATE POLICY anon_can_read_risk_scores ON public.sentinel_risk_scores FOR SELECT USING (true);
        END IF;
      END $$`,
    ];

    for (const stmt of stmts) {
      try {
        await client.queryArray(stmt);
        results[stmt.substring(0, 40)] = "ok";
      } catch (e: any) {
        results[stmt.substring(0, 40)] = `error: ${e.message}`;
      }
    }

    // Verify
    const check = await client.queryObject<{ tablename: string; rowsecurity: boolean }>(
      "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('sentinel_events', 'sentinel_risk_scores')"
    );
    const policies = await client.queryObject(
      "SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('sentinel_events', 'sentinel_risk_scores')"
    );

    await client.end();

    return new Response(JSON.stringify({
      status: "done",
      results,
      tables: check.rows,
      policies: policies.rows,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
