// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate Coefficient of Variation (CV) = (Standard Deviation / Mean) * 100
function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);
  return (stdDev / mean) * 100;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY");
    const FRED_API_KEY = Deno.env.get("FRED_API_KEY");

    if (!FIREWORKS_API_KEY) throw new Error("FIREWORKS_API_KEY is not configured");
    if (!FRED_API_KEY) throw new Error("FRED_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching FRED macroeconomic tracking list from database...");
    
    // Fetch countries that have a FRED mapping
    const { data: mappedCountries, error: fetchError } = await supabase
      .from('country_metadata')
      .select('iso2_code, country_name, fred_fx_series_id')
      .not('fred_fx_series_id', 'is', null);

    if (fetchError) throw fetchError;
    if (!mappedCountries || mappedCountries.length === 0) {
      return new Response(JSON.stringify({ message: "No FRED mappings found in country_metadata." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const eventsToProcess = [];
    const metadataToUpsert = [];

    // Process each configured country
    for (const country of mappedCountries) {
      const seriesId = country.fred_fx_series_id;
      console.log(`Fetching FRED data for ${country.country_name} (${seriesId})...`);

      // Fetch last 30 observations (roughly a month of trading days)
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=30&sort_order=desc`;
      
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`Failed to fetch ${seriesId} from FRED.`);
          continue;
        }

        const data = await res.json();
        const observations = data.observations || [];
        
        // Filter out "." which FRED uses for missing/holiday data
        const validValues = observations
          .map((obs: any) => obs.value)
          .filter((v: string) => v !== ".")
          .map(Number);

        if (validValues.length === 0) continue;

        const latestRate = validValues[0];
        const volatility = calculateVolatility(validValues);

        metadataToUpsert.push({
          iso2_code: country.iso2_code,
          fred_currency_volatility: volatility,
          last_updated: new Date().toISOString()
        });

        // Determine severity based on 30-day Coefficient of Variation
        // CV < 1% is very stable. CV > 5% is highly volatile (currency crisis territory for 30 days)
        let severity = 1;
        if (volatility > 10) severity = 10;
        else if (volatility > 5) severity = 8;
        else if (volatility > 3) severity = 5;
        else if (volatility > 1) severity = 3;

        const headline = `Currency Volatility Baseline: ${country.country_name} FX Rate`;
        const full_text = `FRED MACROECONOMIC BASELINE: The 30-day exchange rate volatility (Coefficient of Variation) for ${country.country_name} stands at ${volatility.toFixed(2)}%. The latest recorded rate is ${latestRate}. High volatility scores indicate potential supply chain and import/export pricing instability.`;

        eventsToProcess.push({
          source_url: `fred-baseline-fx-${country.iso2_code}`,
          headline,
          event_type: 'baseline_metric',
          severity,
          occurred_at: new Date().toISOString(),
          country_code: country.iso2_code,
          full_text,
          raw_gdelt: { volatility, latestRate, observations: validValues.length } 
        });

      } catch (err) {
        console.error(`Error processing FRED series ${seriesId}:`, err);
      }
    }

    if (metadataToUpsert.length > 0) {
      console.log(`Upserting FRED volatility metrics for ${metadataToUpsert.length} countries...`);
      const { error: metaError } = await supabase
        .from('country_metadata')
        .upsert(metadataToUpsert, { onConflict: 'iso2_code' });
      
      if (metaError) {
         console.warn("Failed to upsert country_metadata:", metaError);
      }
    }

    if (eventsToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No data processed." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Generate Embeddings ───────────────────────────────────
    console.log("Generating Vector Embeddings for FRED baselines...");
    
    const batchSize = 100;
    const allEmbeddings = [];

    for (let i = 0; i < eventsToProcess.length; i += batchSize) {
      const batch = eventsToProcess.slice(i, i + batchSize);
      const requests = batch.map(event => ({
        model: "models/nomic-ai/nomic-embed-text-v1.5",
        content: { parts: [{ text: `Event: ${event.headline}\nType: ${event.event_type}\nLocation: ${event.country_code}\nAnalysis: ${event.full_text}` }] },
        outputDimensionality: 768
      }));

      const embedRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/nomic-ai/nomic-embed-text-v1.5:batchEmbedContents?key=${FIREWORKS_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests })
        }
      );

      if (!embedRes.ok) {
        console.warn(`[WARNING] ai Embedding batch failed.`);
        for (let j = 0; j < batch.length; j++) allEmbeddings.push(null);
      } else {
        const json = await embedRes.json();
        const batchEmbeddings = json.embeddings || [];
        for (let j = 0; j < batch.length; j++) {
          allEmbeddings.push(batchEmbeddings[j]?.values || null);
        }
      }
    }

    for (let i = 0; i < eventsToProcess.length; i++) {
      if (allEmbeddings[i]) {
        eventsToProcess[i].embedding = allEmbeddings[i];
      }
    }

    // ── Upsert into database ───────────────────────────────────
    const { error: insertError } = await supabase
      .from('sentinel_events')
      .upsert(eventsToProcess, { onConflict: 'source_url' });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      message: "FRED baseline polling completed", 
      events_inserted: eventsToProcess.length,
      metadata_updated: metadataToUpsert.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in FRED poller:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});


