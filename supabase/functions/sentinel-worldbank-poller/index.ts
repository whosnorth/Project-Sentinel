// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WB_BASE_URL = "http://api.worldbank.org/v2/country/all/indicator";

async function fetchIndicator(indicatorCode: string) {
  // mrv=1 fetches the most recent non-null value per country.
  const res = await fetch(`${WB_BASE_URL}/${indicatorCode}?format=json&per_page=500&mrv=1`);
  if (!res.ok) throw new Error(`Failed to fetch ${indicatorCode}`);
  const data = await res.json();
  return data[1] || []; // Data array is the 2nd element
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY");

    if (!FIREWORKS_API_KEY) throw new Error("FIREWORKS_API_KEY is not configured");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching World Bank baseline structural indicators...");

    // Fetch indicators in parallel
    const [lpiData, cpiaData, gdpData] = await Promise.all([
      fetchIndicator("LP.LPI.OVRL.XQ"), // Logistics Performance Index (Overall)
      fetchIndicator("IQ.CPA.PROP.XQ"), // CPIA property rights/governance
      fetchIndicator("NY.GDP.MKTP.KD.ZG") // GDP Growth (Annual %)
    ]);

    // Aggregate by 2-letter ISO code (which World Bank conveniently provides in country.id)
    const countries = new Map<string, any>();

    const processArray = (arr: any[], keyName: string) => {
      for (const item of arr) {
        if (!item.country?.id) continue;
        const ccode = item.country.id;
        
        // Skip aggregates like 'WLD' (World) or 'ARB' (Arab World) which often don't have valid 2-letter iso2 codes (World Bank uses 2 letters for aggregates too like '1W', but real countries are standard iso2)
        if (/\d/.test(ccode)) continue; 

        if (!countries.has(ccode)) {
          countries.set(ccode, {
            name: item.country.value,
            lpi: null,
            cpia: null,
            gdp: null
          });
        }
        countries.get(ccode)[keyName] = item.value;
      }
    };

    processArray(lpiData, 'lpi');
    processArray(cpiaData, 'cpia');
    processArray(gdpData, 'gdp');

    const eventsToProcess = [];
    const metadataToUpsert = [];

    for (const [countryCode, metrics] of countries.entries()) {
      // If we have literally no data for this country across the 3 metrics, skip it.
      if (metrics.lpi === null && metrics.cpia === null && metrics.gdp === null) continue;

      metadataToUpsert.push({
        iso2_code: countryCode,
        country_name: metrics.name,
        wb_lpi_score: metrics.lpi,
        wb_cpia_score: metrics.cpia,
        last_updated: new Date().toISOString()
      });

      // Calculate severity primarily based on Logistics Performance Index (LPI is 1-5, where 1 is worst)
      // If LPI is missing, default to 3 (moderate) and adjust with CPIA if available.
      let severity = 5; // Default baseline
      
      if (metrics.lpi !== null) {
        // LPI is 1 to 5. We want a 1 to 10 severity where 1 LPI = 10 Severity.
        // Formula: 10 - ((LPI - 1) * 2.25) -> bounds roughly 1 to 10
        severity = Math.round(10 - ((metrics.lpi - 1) * 2.25));
      } else if (metrics.cpia !== null) {
        // CPIA is 1 to 6 (higher is better governance). 
        severity = Math.round(10 - ((metrics.cpia - 1) * 1.8));
      }

      // Cap bounds
      if (severity < 1) severity = 1;
      if (severity > 10) severity = 10;

      const headline = `Comprehensive Baseline Infrastructure & Stability: ${metrics.name}`;
      
      // Structure the full text prioritizing LPI
      const lpiText = metrics.lpi !== null ? `Logistics Performance Index (LPI) is ${metrics.lpi.toFixed(2)} out of 5.` : "Logistics Performance Index data is unavailable.";
      const cpiaText = metrics.cpia !== null ? `Governance and Property Rights rating is ${metrics.cpia.toFixed(2)} out of 6.` : "";
      const gdpText = metrics.gdp !== null ? `Recent Annual GDP Growth is ${metrics.gdp.toFixed(2)}%.` : "";

      const full_text = `CRITICAL LOGISTICS BASELINE: The ${lpiText} SECONDARY METRICS: ${cpiaText} ${gdpText} This structural baseline provides context on the underlying fragility and infrastructural resilience of ${metrics.name}.`;

      eventsToProcess.push({
        source_url: `worldbank-baseline-${countryCode}`,
        headline,
        event_type: 'baseline_metric',
        severity,
        occurred_at: new Date().toISOString(), // This is updated monthly
        country_code: countryCode,
        full_text,
        raw_gdelt: metrics 
      });
    }

    console.log(`Processed baseline metrics for ${eventsToProcess.length} countries.`);

    if (metadataToUpsert.length > 0) {
      console.log("Upserting raw indicators into country_metadata...");
      const { error: metaError } = await supabase
        .from('country_metadata')
        .upsert(metadataToUpsert, { onConflict: 'iso2_code' });
      
      if (metaError) {
         console.warn("Failed to upsert country_metadata:", metaError);
      }
    }

    if (eventsToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No data found." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Generate Embeddings ───────────────────────────────────
    console.log("Generating Vector Embeddings...");
    
    // Split into batches of 100 for AI API limits
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
        const errorText = await embedRes.text();
        console.warn(`[WARNING] ai Embedding batch failed: ${errorText}`);
        // We push nulls to keep indices aligned if it fails
        for (let j = 0; j < batch.length; j++) allEmbeddings.push(null);
      } else {
        const json = await embedRes.json();
        const batchEmbeddings = json.embeddings || [];
        for (let j = 0; j < batch.length; j++) {
          allEmbeddings.push(batchEmbeddings[j]?.values || null);
        }
      }
    }

    // Attach embeddings
    for (let i = 0; i < eventsToProcess.length; i++) {
      if (allEmbeddings[i]) {
        eventsToProcess[i].embedding = allEmbeddings[i];
      }
    }

    // ── Upsert into database ───────────────────────────────────
    // Upsert by source_url (e.g. worldbank-baseline-NG)
    const { error: insertError } = await supabase
      .from('sentinel_events')
      .upsert(eventsToProcess, { onConflict: 'source_url' });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      message: "World Bank baseline polling completed", 
      events_inserted: eventsToProcess.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in World Bank poller:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

