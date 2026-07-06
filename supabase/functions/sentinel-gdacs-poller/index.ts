// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY");

const GDACS_GEOJSON_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?limit=50";

function mapSeverity(alertLevel: string): number {
  if (alertLevel === "Red") return 9;
  if (alertLevel === "Orange") return 7;
  if (alertLevel === "Green") return 4;
  return 5;
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(GDACS_GEOJSON_URL);
    if (!res.ok) throw new Error(`GDACS fetch failed: ${res.status}`);
    const data = await res.json();
    const features = data.features || [];

    const eventsToProcess = [];

    for (const feature of features) {
      const p = feature.properties;
      const coords = feature.geometry?.coordinates; // [lng, lat]
      if (!p || !coords) continue;

      const lng = coords[0];
      const lat = coords[1];

      // To handle multiple countries, we map an event for each country it affects
      // This ensures Sentinel's country filter works perfectly
      let affectedCodes = ["XX"];
      if (p.affectedcountries && p.affectedcountries.length > 0) {
        affectedCodes = p.affectedcountries.map((c: any) => c.iso2);
      }

      for (const countryCode of affectedCodes) {
        const headline = `GDACS Alert: ${p.htmldescription || p.name}`;
        const full_text = `Disaster Type: ${p.eventtype}. Alert Level: ${p.alertlevel}. ${p.description}.`;
        const sourceUrl = p.url?.report ? `${p.url.report}&cc=${countryCode}` : `gdacs-${p.eventid}-${countryCode}`;

        eventsToProcess.push({
          source_url: sourceUrl,
          headline,
          country_code: countryCode,
          lat,
          lng,
          event_type: "social", // Natural disasters cause social/infrastructure impact
          severity: mapSeverity(p.alertlevel),
          raw_gdelt: feature,
          occurred_at: p.fromdate ? new Date(p.fromdate).toISOString() : new Date().toISOString()
        });
      }
    }

    if (eventsToProcess.length === 0) {
      return new Response(JSON.stringify({ ok: true, ingested: 0, message: "No events" }), { headers: { "Content-Type": "application/json" } });
    }

    // ── Generate Embeddings via AI Platform ───────────────────────────────────
    let dbEvents = eventsToProcess.map(e => ({ ...e, embedding: null }));

    if (FIREWORKS_API_KEY) {
      try {
        const inputs = dbEvents.map(event => `Event: ${event.headline}\nType: ${event.event_type}\nLocation: ${event.country_code}\nAnalysis: ${event.full_text}`);
        
        // AI Platform uses standard OpenAI embeddings format
        const embedRes = await fetch("https://api.fireworks.ai/inference/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openai/text-embedding-3-small",
            input: inputs,
            dimensions: 768 // Important: sentinel_events vector is 768
          })
        });

        if (embedRes.ok) {
          const json = await embedRes.json();
          if (json.data && json.data.length > 0) {
            for (let i = 0; i < dbEvents.length; i++) {
              dbEvents[i].embedding = json.data[i]?.embedding || null;
            }
          }
        } else {
          console.error("AI Platform embedding failed:", await embedRes.text());
        }
      } catch (err) {
        console.error("Failed to generate AI Platform embeddings:", err);
      }
    }

    const { error: insertError } = await supabase
      .from("sentinel_events")
      .upsert(dbEvents, { onConflict: "source_url", ignoreDuplicates: true });
      
    if (insertError) throw insertError;

    console.log(`GDACS poller: ingested ${dbEvents.length}`);

    return new Response(JSON.stringify({ ok: true, ingested: dbEvents.length }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("GDACS poller error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

