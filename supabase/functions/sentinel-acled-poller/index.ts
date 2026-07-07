// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ACLED_EMAIL = Deno.env.get("ACLED_EMAIL")!;
const ACLED_PASSWORD = Deno.env.get("ACLED_PASSWORD")!;
const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY")!;

// ─── ISO-3166-1 numeric → alpha-2 lookup (covers all ACLED countries) ──────
const ISO_NUMERIC_TO_ALPHA2: Record<number, string> = {
  4:"AF",8:"AL",12:"DZ",24:"AO",32:"AR",50:"BD",56:"BE",64:"BT",68:"BO",76:"BR",
  104:"MM",108:"BI",116:"KH",120:"CM",140:"CF",144:"LK",148:"TD",156:"CN",170:"CO",
  178:"CG",180:"CD",188:"CR",192:"CU",204:"BJ",218:"EC",818:"EG",222:"SV",231:"ET",
  232:"ER",246:"FI",288:"GH",300:"GR",320:"GT",324:"GN",332:"HT",340:"HN",356:"IN",
  360:"ID",364:"IR",368:"IQ",376:"IL",384:"CI",400:"JO",404:"KE",408:"KP",410:"KR",
  418:"LA",422:"LB",430:"LR",434:"LY",454:"MW",458:"MY",466:"ML",484:"MX",504:"MA",
  508:"MZ",516:"NA",524:"NP",558:"NI",562:"NE",566:"NG",586:"PK",591:"PA",598:"PG",
  604:"PE",608:"PH",630:"PR",642:"RO",646:"RW",682:"SA",686:"SN",694:"SL",706:"SO",
  710:"ZA",724:"ES",729:"SD",740:"SR",752:"SE",756:"CH",760:"SY",764:"TH",788:"TN",
  792:"TR",800:"UG",804:"UA",784:"AE",826:"GB",840:"US",858:"UY",860:"UZ",862:"VE",
  704:"VN",887:"YE",894:"ZM",716:"ZW",834:"TZ",854:"BF",270:"GM",266:"GA",226:"GQ",
  562:"NE",678:"ST",174:"KM",480:"MU",450:"MG",462:"MV",496:"MN",760:"SY",248:"AX",
  175:"YT",638:"RE",548:"VU",90:"SB",242:"FJ",598:"PG",598:"PG",776:"TO",242:"FJ",
};

function getAlpha2FromISO(isoNumeric: number | string | null): string | null {
  if (!isoNumeric) return null;
  const num = typeof isoNumeric === "string" ? parseInt(isoNumeric) : isoNumeric;
  return ISO_NUMERIC_TO_ALPHA2[num] ?? null;
}

function getSeverity(event_type: string, sub_event_type: string, fatalities: number): number {
  let baseSev = 3;
  if (event_type === "Battles" || event_type === "Explosions/Remote violence" || event_type === "Violence against civilians") {
    baseSev = 7;
  } else if (event_type === "Riots") {
    baseSev = 6;
  } else if (event_type === "Protests") {
    baseSev = 4;
  } else if (event_type === "Strategic developments") {
    baseSev = 4;
  }

  // Add fatalities modifier (cap at +3 to avoid blowing past 10 too easily, or maybe +4)
  const modifier = Math.min(fatalities, 4);
  return Math.min(baseSev + modifier, 10);
}

function classifyEventType(event_type: string): string {
  if (["Battles", "Explosions/Remote violence", "Violence against civilians", "Riots"].includes(event_type)) {
    return "security";
  }
  if (event_type === "Protests") return "social";
  if (event_type === "Strategic developments") return "economy";
  return "security";
}

function condense(ev: Record<string, unknown>) {
  return {
    url:    ev.source_url,
    cc:     ev.country_code,
    geo:    [ev.city, ev.region].filter(Boolean).join(", ") || "Unknown",
    act1:   ev._actor1 || null,
    act2:   ev._actor2 || null,
    event:  ev._sub_event_type,
    sev:    ev.severity,
  };
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (!ACLED_EMAIL || !ACLED_PASSWORD) {
      throw new Error("ACLED_EMAIL or ACLED_PASSWORD missing in secrets.");
    }

    // ── 1. OAuth Authentication ───────────────────────────────────────────────
    const authRes = await fetch("https://acleddata.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: ACLED_EMAIL,
        password: ACLED_PASSWORD,
        grant_type: "password",
        client_id: "acled",
        scope: "authenticated"
      })
    });

    if (!authRes.ok) {
      throw new Error(`ACLED auth failed: ${authRes.status} ${await authRes.text()}`);
    }

    const authData = await authRes.json();
    const token = authData.access_token;

    // ── 2. Fetch ACLED Data ───────────────────────────────────────────────────
    const twoDaysAgo = Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60);
    const url = `https://acleddata.com/api/acled/read?_format=json&timestamp=${twoDaysAgo}|9999999999&timestamp_where=BETWEEN&limit=5000`;
    
    const dataRes = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!dataRes.ok) {
      throw new Error(`ACLED data fetch failed: ${dataRes.status} ${await dataRes.text()}`);
    }

    const dataJson = await dataRes.json();
    const rows = dataJson.data || [];

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, ingested: 0, message: "No new ACLED events" }), { headers: { "Content-Type": "application/json" } });
    }

    // ── 3. Parse rows (Zero-Compute Classification) ───────────────────────────
    const events: any[] = [];
    const seenUrls = new Set<string>();
    const HIGH_SEVERITY_BATCH: any[] = [];

    for (const row of rows) {
      const sourceUrl = `acled://${row.event_id_cnty}`;
      if (seenUrls.has(sourceUrl)) continue;
      seenUrls.add(sourceUrl);

      const fatalities = parseInt(row.fatalities) || 0;
      const severity = getSeverity(row.event_type, row.sub_event_type, fatalities);
      const type = classifyEventType(row.event_type);
      const actorStr = [row.actor1, row.actor2].filter(Boolean).join(" & ") || row.country;
      const geo = row.location || row.admin1 || row.country;
      const headline = geo ? `${actorStr}: ${row.sub_event_type} in ${geo}` : `${actorStr}: ${row.sub_event_type}`;

      // Use full ISO-3166-1 numeric lookup. Falls back to null if unmapped.
      const country_code = getAlpha2FromISO(row.iso) ?? null;

      const ev = {
        source_url: sourceUrl,
        headline,
        country_code,
        region: row.admin1 || null,
        city: row.location || null,
        lat: parseFloat(row.latitude) || null,
        lng: parseFloat(row.longitude) || null,
        event_type: type,
        severity,
        occurred_at: row.event_date ? new Date(row.event_date).toISOString() : new Date().toISOString(),
        raw_acled: row,
        embedding: null, // default
        
        // Internal fields
        _actor1: row.actor1,
        _actor2: row.actor2,
        _sub_event_type: row.sub_event_type
      };

      events.push(ev);
      if (severity >= 8) HIGH_SEVERITY_BATCH.push(ev);
    }

    // ── 4. Generate Embeddings ────────────────────────────────────────────────
    if (FIREWORKS_API_KEY && events.length > 0) {
      try {
        // Only embed up to 100 at a time to stay under free tier limits for now
        const toEmbed = events.slice(0, 100);
        const inputTexts = toEmbed.map(event => {
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
            for (let i = 0; i < toEmbed.length; i++) {
              toEmbed[i].embedding = json.data[i]?.embedding || null;
            }
          }
        } else {
          console.error("Embedding generation failed:", await res.text());
        }

      } catch (err) {
        console.error("Failed to generate embeddings:", err);
      }
    }

    // ── 5. Upsert ─────────────────────────────────────────────────────────────
    const dbEvents = events.map(({ _actor1, _actor2, _sub_event_type, ...rest }) => rest);

    const { error: insertError } = await supabase
      .from("sentinel_events")
      .upsert(dbEvents, { onConflict: "source_url", ignoreDuplicates: false });
      
    if (insertError) throw insertError;

    // ── 6. Fire Macro Orchestrator ───────────────────────────────────────────────────
    if (HIGH_SEVERITY_BATCH.length > 0) {
      const condensed = HIGH_SEVERITY_BATCH.slice(0, 10).map(condense);
      await supabase.functions.invoke("sentinel-macro-orchestrator", {
        body: { events: condensed },
      });
    }

    console.log(`ACLED poller: ingested ${events.length}, AI batch: ${HIGH_SEVERITY_BATCH.length}`);

    return new Response(
      JSON.stringify({ ok: true, ingested: events.length, ai_batch: HIGH_SEVERITY_BATCH.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ACLED poller error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
