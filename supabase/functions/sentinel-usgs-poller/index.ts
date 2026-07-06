// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch real-time earthquake telemetry from USGS
// all_day.geojson is updated every minute
const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY");

    if (!FIREWORKS_API_KEY) {
      throw new Error("FIREWORKS_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Fetching USGS Seismic Telemetry...`);
    const response = await fetch(USGS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch USGS data: ${response.statusText}`);
    }

    const geojson = await response.json();
    const features = geojson.features || [];
    
    console.log(`Fetched ${features.length} total global seismic events in the last 24h.`);

    const eventsToProcess = [];

    for (const feature of features) {
      const mag = feature.properties.mag;
      
      // Strict threshold: Only process earthquakes Magnitude 4.5 or greater
      if (mag == null || mag < 4.5) continue;

      const place = feature.properties.place || "Unknown Location";
      const timeMs = feature.properties.time;
      const url = feature.properties.url;
      const type = feature.properties.type; // usually "earthquake"

      // We only care about actual earthquakes or similar seismic events
      if (type !== "earthquake") continue;

      const lng = feature.geometry.coordinates[0];
      const lat = feature.geometry.coordinates[1];
      const depth = feature.geometry.coordinates[2];

      const occurred_at = new Date(timeMs).toISOString();

      // Extract a rough country/region code from the end of the place string (e.g. "..., Taiwan")
      const placeParts = place.split(',');
      let country_code = 'GL';
      if (placeParts.length > 1) {
          const rawCountry = placeParts[placeParts.length - 1].trim();
          // Extremely basic mapping for some key regions, otherwise falls back to GL
          if (rawCountry.toLowerCase() === 'nigeria') country_code = 'NG';
          else if (rawCountry.toLowerCase() === 'japan') country_code = 'JP';
          else if (rawCountry.toLowerCase() === 'taiwan') country_code = 'TW';
      }

      // Calculate severity based on Magnitude
      // Mag 4.5 = 5 (Moderate risk)
      // Mag 5.0+ = 6
      // Mag 6.0+ = 8 (Severe risk to infra)
      // Mag 7.0+ = 9 
      // Mag 8.0+ = 10 (Catastrophic)
      let severity = 5;
      if (mag >= 8.0) severity = 10;
      else if (mag >= 7.0) severity = 9;
      else if (mag >= 6.0) severity = 8;
      else if (mag >= 5.0) severity = 6;

      const headline = `Magnitude ${mag.toFixed(1)} Earthquake Detected: ${place}`;
      const full_text = `The USGS has recorded a Magnitude ${mag.toFixed(1)} earthquake at a depth of ${depth} km. Location: ${place}. This seismic event has exceeded the critical 4.5 threshold and poses a potential risk to local infrastructure, port operations, and supply chain logistics in the affected region.`;

      eventsToProcess.push({
        source_url: url,
        headline,
        event_type: 'infrastructure',
        severity,
        occurred_at,
        lat,
        lng,
        country_code,
        full_text,
        raw_gdelt: feature.properties // store raw properties for completeness
      });
    }

    console.log(`Filtered down to ${eventsToProcess.length} high-magnitude events (>= 4.5 Mag) to process.`);

    if (eventsToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No significant earthquakes found.", count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Generate Embeddings for hybrid search ───────────────────────────────────
    console.log("Generating Vector Embeddings...");
    const inputTexts = eventsToProcess.map(event => `Event: ${event.headline}\nType: ${event.event_type}\nLocation: ${event.country_code || "Global"}\nAnalysis: `); const res = await fetch(`https://api.fireworks.ai/inference/v1/embeddings`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FIREWORKS_API_KEY}` }, body: JSON.stringify({ model: "nomic-ai/nomic-embed-text-v1.5", input: inputTexts }) }); if (res.ok) { const json = await res.json(); if (json.data) { for (let i = 0; i < eventsToProcess.length; i++) { eventsToProcess[i].embedding = json.data[i]?.embedding || null; } } }
    // ── Upsert into database ───────────────────────────────────
    const { error: insertError } = await supabase
      .from('sentinel_events')
      .upsert(eventsToProcess, { onConflict: 'source_url' });

    if (insertError) {
      throw insertError;
    }

    return new Response(JSON.stringify({ 
      message: "USGS Hazards polling completed", 
      events_inserted: eventsToProcess.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in USGS poller:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

