// @ts-nocheck
// sentinel-gdelt-poller: Fetch GDELT 2.0 latest events and ingest into sentinel_events
// Credit-optimised: full classification is rule-based (CAMEO + Goldstein).
// AI is ONLY invoked for Severity >= 8 events (true crises) — as a batch.
// Deploy as: supabase functions deploy sentinel-gdelt-poller

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GDELT_LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt";

// ─── No Target Countries, global fetch ────────────────────────────────────────────────────────

// ─── CAMEO root code → event category (fully deterministic, zero credits) ───
// CAMEO codes are a standardised taxonomy — no AI needed for classification.
const CAMEO_CATEGORY: Record<string, string> = {
  "01": "positive", // Make public statement
  "02": "positive", // Appeal
  "03": "positive", // Express intent to cooperate
  "04": "social",   // Consult
  "05": "positive", // Engage in diplomatic cooperation
  "06": "economy",  // Engage in material cooperation
  "07": "infrastructure", // Provide aid / infrastructure
  "08": "social",   // Yield
  "09": "security", // Investigate
  "10": "security", // Demand
  "11": "social",   // Disapprove
  "12": "security", // Reject
  "13": "security", // Threaten
  "14": "social",   // Protest
  "15": "security", // Exhibit force posture
  "16": "security", // Reduce relations
  "17": "security", // Coerce
  "18": "security", // Assault
  "19": "security", // Fight
  "20": "security", // Engage in unconventional mass violence
};

// ─── CAMEO root code → human-readable short label ───────────────────────────
const CAMEO_LABEL: Record<string, string> = {
  "01": "Public Statement", "02": "Appeal", "03": "Cooperation Intent",
  "04": "Consultation",     "05": "Diplomatic Cooperation",
  "06": "Material Cooperation", "07": "Aid Provided", "08": "Yield",
  "09": "Investigation",    "10": "Demand",      "11": "Disapproval",
  "12": "Rejection",        "13": "Threat",      "14": "Protest",
  "15": "Force Posture",    "16": "Relations Cut","17": "Coercion",
  "18": "Assault",          "19": "Armed Conflict","20": "Mass Violence",
};

function classifyFromCameo(cameo: string): { type: string; label: string } {
  const root = cameo.slice(0, 2).padStart(2, "0");
  return {
    type:  CAMEO_CATEGORY[root] ?? "social",
    label: CAMEO_LABEL[root]    ?? `CAMEO-${cameo}`,
  };
}

// ─── Goldstein scale → severity 1-10 (linear mapping, zero credits) ──────────
// Goldstein scale ranges from -10 (most destabilising) to +10 (most cooperative)
function scoreFromGoldstein(gs: number): number {
  // We only ingest negative/neutral events so we map [-10, 3] → [10, 1]
  if (gs <= -8) return 10;
  if (gs <= -6) return 9;
  if (gs <= -4) return 8;
  if (gs <= -2) return 7;
  if (gs <= 0)  return 6;
  if (gs <= 1)  return 4;
  if (gs <= 2)  return 3;
  return 2;
}

// ─── Lightweight condensed payload passed to AI (avoids large raw payloads) ──
// Only fields the AI actually needs to write a meaningful one-line summary.
function condense(ev: Record<string, unknown>) {
  return {
    url:    ev.source_url,
    cc:     ev.country_code,
    geo:    [ev.city, ev.region].filter(Boolean).join(", ") || "Unknown",
    act1:   ev._actor1 || null,
    act2:   ev._actor2 || null,
    event:  ev._cameo_label,
    gs:     ev._goldstein,
    sev:    ev.severity,
  };
}

// ─── Source credibility scoring (4.3) ───────────────────────────────────
const HIGH_CREDIBILITY = ["reuters.com","apnews.com","bbc.com","bbc.co.uk","ft.com",
  "bloomberg.com","wsj.com","nytimes.com","theguardian.com","economist.com",
  "aljazeera.com","dw.com","france24.com","afp.com","un.org","state.gov"];
const MED_CREDIBILITY  = ["xinhua.net","globaltimes.cn","rt.com","tass.com","cnbc.com",
  "cnn.com","nbcnews.com","abc.net.au","rfi.fr"];

function scoreCredibility(url: string): number {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (HIGH_CREDIBILITY.some(d => host.endsWith(d))) return 0.9;
    if (MED_CREDIBILITY.some(d => host.endsWith(d)))  return 0.6;
    return 0.3; // unknown source
  } catch { return 0.3; }
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // ── 1. Fetch GDELT lastupdate manifest ───────────────────────────────────
    const manifestRes = await fetch(GDELT_LASTUPDATE_URL);
    if (!manifestRes.ok) throw new Error(`Manifest fetch failed: ${manifestRes.status}`);
    const manifest = await manifestRes.text();

    let eventsUrl: string | null = null;
    for (const line of manifest.trim().split("\n")) {
      const parts = line.trim().split(" ");
      if (parts.length >= 3 && parts[2].includes("export")) {
        eventsUrl = parts[2].trim();
        break;
      }
    }
    if (!eventsUrl) throw new Error("Could not find Events CSV URL in manifest");

    // ── 2. Download + unzip ──────────────────────────────────────────────────
    const zipRes = await fetch(eventsUrl);
    if (!zipRes.ok) throw new Error(`ZIP fetch failed: ${zipRes.status}`);
    const zipBuffer = new Uint8Array(await zipRes.arrayBuffer());
    const unzipped  = unzipSync(zipBuffer);
    const csvKey    = Object.keys(unzipped).find((k) => k.match(/\.csv$/i));
    if (!csvKey) throw new Error("No CSV inside ZIP");
    const rows = new TextDecoder().decode(unzipped[csvKey]).trim().split("\n");

    // ── 3. Parse rows — pure rule-based classification, ZERO AI calls ────────
    // GDELT 2.0 Events CSV columns (tab-separated):
    // 0: GLOBALEVENTID, 1: SQLDATE, 6: Actor1Name, 16: Actor2Name
    // 26: EventCode, 30: GoldsteinScale
    // 52: ActionGeo_FullName, 53: ActionGeo_CountryCode
    // 56: ActionGeo_Lat, 57: ActionGeo_Long, 60: SOURCEURL
    const events: any[]       = [];
    const seenUrls            = new Set<string>();
    const HIGH_SEVERITY_BATCH: any[] = []; // Only severity >= 8 get AI treatment

    for (const row of rows) {
      const c = row.split("\t");
      if (c.length < 61) continue;

      let cc = c[53]?.toUpperCase();
      if (!cc) continue;
      
      // GDELT uses FIPS 10-4 country codes. FIPS 'NI' is Nigeria (ISO 'NG').
      // FIPS 'NG' is Niger (ISO 'NE').
      if (cc === "NI") cc = "NG";
      else if (cc === "NG") cc = "NE";

      const url = c[60]?.trim();
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);

      const gs       = parseFloat(c[30]) || 0;

      const lat      = parseFloat(c[56]) || null;
      const lng      = parseFloat(c[57]) || null;
      if (!lat || !lng) continue;

      const cameo    = c[26] || "";
      const { type, label } = classifyFromCameo(cameo);
      const severity = scoreFromGoldstein(gs);

      const geo      = c[52] || "";
      const geoParts = geo.split(",");
      const city     = geoParts[0]?.trim() || null;
      const region   = geoParts[1]?.trim() || null;

      // Actor names from GDELT (Actor1Name col 6, Actor2Name col 16)
      const actor1   = c[6]?.trim()  || null;
      const actor2   = c[16]?.trim() || null;

      // Build a rule-derived headline that reads naturally:
      // "<Actor1> [and <Actor2>]: <EventLabel> in <Geo>"
      const actorStr = [actor1, actor2].filter(Boolean).join(" & ") || cc;
      const headline = geo
        ? `${actorStr}: ${label} in ${geo}`
        : `${actorStr}: ${label}`;

      const ev = {
        source_url:   url,
        headline,
        country_code: cc,
        region,
        city,
        lat,
        lng,
        event_type:   type,
        cameo_code:   cameo,
        severity,
        tone:         parseFloat(c[34]) || null, // 4.4: GDELT tone column (media sentiment)
        source_credibility: scoreCredibility(url), // 4.3: domain-based credibility
        // Lightweight raw blob — only store the fields we actually use for AI/display
        raw_gdelt: {
          id:       c[0],
          date:     c[1],
          gs,
          tone:     parseFloat(c[34]) || 0,
          articles: parseInt(c[33])   || 0,
          actor1,
          actor2,
        },
        occurred_at: new Date().toISOString(),
        // Internal fields used for condensed AI payload (not persisted to DB)
        _actor1:      actor1,
        _actor2:      actor2,
        _cameo_label: label,
        _goldstein:   gs,
      };

      events.push(ev);
      if (severity >= 8) HIGH_SEVERITY_BATCH.push(ev); // critical event — worth AI summary
      if (events.length >= 75) break; // keep run-time bounded
    }

    if (events.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, ingested: 0, message: "No matching events" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 4. Generate Embeddings & Insert ──────────────────────────────────────
    const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY");
    let dbEvents = events.map(({ _actor1, _actor2, _cameo_label, _goldstein, ...rest }) => ({
      ...rest,
      embedding: null
    }));

    if (FIREWORKS_API_KEY && dbEvents.length > 0) {
      try {
        const inputTexts = dbEvents.map(event => {
          const aiSummary = "";
          return `Event: ${event.headline}\nType: ${event.event_type}\nLocation: ${event.country_code || "Global"}\nAnalysis: ${aiSummary}`;
        });

        const res = await fetch(`https://api.fireworks.ai/inference/v1/embeddings`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${FIREWORKS_API_KEY}`
          },
          body: JSON.stringify({
            model: "nomic-ai/nomic-embed-text-v1.5",
            input: inputTexts
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            for (let i = 0; i < dbEvents.length; i++) {
              dbEvents[i].embedding = json.data[i]?.embedding || null;
            }
          }
        } else {
          console.error("Embedding generation failed during polling:", await res.text());
        }
      } catch (err) {
        console.error("Failed to generate embeddings, inserting with null:", err);
      }
    }
    const { error: insertError } = await supabase
      .from("sentinel_events")
      .upsert(dbEvents, { onConflict: "source_url", ignoreDuplicates: true });
    if (insertError) throw insertError;

    // ── 5. Fire Macro Orchestrator ONLY for high-severity events ────────────────────
    if (HIGH_SEVERITY_BATCH.length > 0) {
      const condensed = HIGH_SEVERITY_BATCH.slice(0, 10).map(condense);
      await supabase.functions.invoke("sentinel-macro-orchestrator", {
        body: { events: condensed },
      });
    }

    console.log(`GDELT poller: ingested ${events.length}, AI batch: ${HIGH_SEVERITY_BATCH.length}`);

    return new Response(
      JSON.stringify({ ok: true, ingested: events.length, ai_batch: HIGH_SEVERITY_BATCH.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("GDELT poller error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
