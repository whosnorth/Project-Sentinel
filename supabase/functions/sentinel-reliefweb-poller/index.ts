// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import iso3166 from "https://esm.sh/iso-3166-1@2.1.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY");

const RELIEFWEB_URL = "https://api.reliefweb.int/v1/reports?appname=sentinel&limit=50&profile=full";

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(RELIEFWEB_URL);
    if (!res.ok) throw new Error(`ReliefWeb fetch failed: ${res.status}`);
    const jsonBody = await res.json();
    const reports = jsonBody.data || [];

    const eventsToProcess = [];

    for (const report of reports) {
      const f = report.fields;
      if (!f) continue;

      const title = f.title || "Unknown Report";
      const body = f.body || "";
      const sourceUrl = f.url || `reliefweb-${report.id}`;
      const iso3 = f.primary_country?.iso3 || null;
      
      let countryCode = "XX";
      if (iso3) {
        const mapped = iso3166.whereAlpha3(iso3);
        if (mapped && mapped.alpha2) {
          countryCode = mapped.alpha2;
        }
      }

      // ReliefWeb doesn't provide precise lat/lng per report reliably, 
      // so we use nulls. Sentinel UI handles country_code matching if lat/lng missing.
      eventsToProcess.push({
        source_url: sourceUrl,
        headline: `ReliefWeb: ${title}`,
        full_text: body.substring(0, 500) + "...", // Truncate for embeddings
        country_code: countryCode,
        event_type: "social", // Humanitarian crises mostly social
        severity: 7, // Default high severity for humanitarian reports
        raw_gdelt: report,
        occurred_at: f.date?.created ? new Date(f.date.created).toISOString() : new Date().toISOString()
      });
    }

    if (eventsToProcess.length === 0) {
      return new Response(JSON.stringify({ ok: true, ingested: 0, message: "No events" }), { headers: { "Content-Type": "application/json" } });
    }

    // ── Generate Embeddings via AI Platform ───────────────────────────────────
    let dbEvents = eventsToProcess.map(e => ({ ...e, embedding: null }));

    if (FIREWORKS_API_KEY) {
      try {
        const inputs = dbEvents.map(event => `Event: ${event.headline}\nType: ${event.event_type}\nLocation: ${event.country_code}\nAnalysis: ${event.full_text}`);
        
        const embedRes = await fetch("https://api.fireworks.ai/inference/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openai/text-embedding-3-small",
            input: inputs,
            dimensions: 768
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

    console.log(`ReliefWeb poller: ingested ${dbEvents.length}`);

    return new Response(JSON.stringify({ ok: true, ingested: dbEvents.length }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("ReliefWeb poller error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

