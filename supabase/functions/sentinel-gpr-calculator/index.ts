// sentinel-gpr-calculator: CSI v2 — Composite Country Stability Index
//
// Synthesises 5 institutional frameworks into a single holistic stability score:
//   FSI  (Fund for Peace — Fragile States Index)          weight: 0.25
//   WGI  (World Bank — Worldwide Governance Indicators)   weight: 0.25
//   ACLED (Armed Conflict Location & Event Data)          weight: 0.20
//   ICRG (PRS Group — Intl Country Risk Guide)            weight: 0.20
//   GPI  (Global Peace Index — IEP)                       weight: 0.10
//
// SCORING CONVENTION: 100 = Most Stable, 0 = Critical (inverted from v1).
// Temporal decay: λ = 0.05/day (score decays ~50% in 14 days).
//
// Deploy: npx supabase functions deploy sentinel-gpr-calculator

// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LAMBDA_DEFAULT = 0.05; // per day — decay constant

// ── Default Framework Weights (used when org has no custom formula) ────────────
const DEFAULT_FRAMEWORK_WEIGHTS = {
  fsi:   0.25,
  wgi:   0.25,
  acled: 0.20,
  icrg:  0.20,
  gpi:   0.10,
};

// ── Default Event Type → Framework Bucket Mapping ────────────────────────────
const DEFAULT_EVENT_BUCKET_MAP: Record<string, string[]> = {
  // Security / violence events → feed FSI-cohesion, GPI-conflict, ACLED-deadliness
  security:       ["fsi_cohesion", "gpi_conflict", "acled_deadliness", "wgi_stability"],
  conflict:       ["fsi_cohesion", "gpi_conflict", "acled_deadliness", "wgi_stability"],
  terrorism:      ["fsi_cohesion", "gpi_conflict", "acled_deadliness", "wgi_stability"],
  violence:       ["fsi_cohesion", "gpi_societal", "acled_deadliness"],
  // Infrastructure events → FSI-public-services, WGI-effectiveness
  infrastructure: ["fsi_services", "wgi_effectiveness", "icrg_economic"],
  environmental:  ["fsi_demographic", "gpi_societal"],
  // Economy events → FSI-economic, ICRG-economic, ICRG-financial
  economy:        ["fsi_economic", "icrg_economic", "icrg_financial"],
  trade:          ["fsi_economic", "icrg_financial"],
  sanctions:      ["fsi_economic", "icrg_financial", "wgi_stability"],
  // Government / political events → FSI-legitimacy, WGI, ICRG-political
  government:     ["fsi_legitimacy", "wgi_effectiveness", "icrg_political"],
  protest:        ["fsi_legitimacy", "wgi_accountability", "gpi_societal"],
  coup:           ["fsi_cohesion", "fsi_legitimacy", "wgi_stability", "icrg_political"],
  election:       ["fsi_legitimacy", "wgi_accountability"],
  corruption:     ["fsi_legitimacy", "wgi_effectiveness", "icrg_political"],
  // Social / humanitarian events → FSI-social, GPI-societal
  social:         ["fsi_social", "gpi_societal", "wgi_accountability"],
  displacement:   ["fsi_refugees", "gpi_societal"],
  humanitarian:   ["fsi_demographic", "fsi_refugees"],
  human_rights:   ["fsi_rights", "wgi_stability", "wgi_accountability"],
  // Military / cross-border events → GPI-militarisation, ACLED, FSI
  military:       ["gpi_militarisation", "acled_deadliness", "fsi_external"],
  border:         ["fsi_external", "gpi_conflict", "icrg_political"],
  // Baseline metric (auto-ingested catch-all) — light contribution across all
  baseline_metric: ["fsi_economic", "icrg_economic"],
  // Positive events — do not contribute to risk (they reduce it, handled below)
  positive:       [],
};

// ── Load org formula config from DB ─────────────────────────────────────────
async function loadOrgFormula(supabase: any, organizationId: string): Promise<{
  lambda: number;
  weights: typeof DEFAULT_FRAMEWORK_WEIGHTS;
  bucketMap: typeof DEFAULT_EVENT_BUCKET_MAP;
} | null> {
  if (!organizationId || organizationId === "00000000-0000-0000-0000-000000000001") {
    return null; // Platform test org — always use defaults
  }
  try {
    const { data, error } = await supabase
      .from("organization_scoring_formulas")
      .select("formula_config")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("formula_type", "gpr")
      .maybeSingle();

    if (error || !data) return null;

    const cfg = data.formula_config;
    const lambda = cfg.decay_lambda ?? LAMBDA_DEFAULT;
    const weights = {
      fsi:   cfg.frameworks?.fsi?.weight   ?? DEFAULT_FRAMEWORK_WEIGHTS.fsi,
      wgi:   cfg.frameworks?.wgi?.weight   ?? DEFAULT_FRAMEWORK_WEIGHTS.wgi,
      acled: cfg.frameworks?.acled?.weight ?? DEFAULT_FRAMEWORK_WEIGHTS.acled,
      icrg:  cfg.frameworks?.icrg?.weight  ?? DEFAULT_FRAMEWORK_WEIGHTS.icrg,
      gpi:   cfg.frameworks?.gpi?.weight   ?? DEFAULT_FRAMEWORK_WEIGHTS.gpi,
    };
    const bucketMap = cfg.bucket_event_map ?? DEFAULT_EVENT_BUCKET_MAP;
    console.log(`[GPR] Loaded custom formula for org ${organizationId}: λ=${lambda}, weights=`, weights);
    return { lambda, weights, bucketMap };
  } catch (e) {
    console.error("[GPR] Failed to load org formula, using defaults:", e);
    return null;
  }
}

// ── Framework Score Computation ────────────────────────────────────────────────
function computeFrameworkScores(events: any[], lambda: number, bucketMap: typeof DEFAULT_EVENT_BUCKET_MAP): {
  fsi: number; wgi: number; acled: number; icrg: number; gpi: number;
  breakdown: Record<string, number>;
} {
  const now = Date.now();

  // Accumulator buckets: { bucketName: { rawRisk: number, count: number } }
  const buckets: Record<string, { rawRisk: number; count: number }> = {};

  // Geographic diffusion for ACLED: track lat/lng to compute spread
  const latlngs: { lat: number; lng: number }[] = [];
  // Positive event count for stability bonus
  let positiveBonus = 0;

  for (const event of events) {
    const deltaT = (now - new Date(event.occurred_at).getTime()) / (1000 * 3600 * 24); // days
    const decayFactor = Math.exp(-lambda * deltaT);
    const severity = event.severity ?? 5;

    const eventType = (event.event_type as string) ?? "baseline_metric";

    // Positive events give a stability bonus (reduce final risk)
    if (eventType === "positive") {
      positiveBonus += severity * decayFactor * 0.5;
      continue;
    }

    const targetBuckets = EVENT_BUCKET_MAP[eventType] ?? EVENT_BUCKET_MAP["baseline_metric"];
    const contribution = severity * decayFactor;

    for (const bucket of targetBuckets) {
      if (!buckets[bucket]) buckets[bucket] = { rawRisk: 0, count: 0 };
      buckets[bucket].rawRisk += contribution;
      buckets[bucket].count += 1;
    }

    // Collect coordinates for ACLED geographic diffusion
    if (event.lat != null && event.lng != null) {
      latlngs.push({ lat: event.lat, lng: event.lng });
    }
  }

  // ── Normalise each bucket (0–100 risk scale, before inversion) ────────────
  // Max possible contribution per event = severity 10 × decayFactor 1.0 = 10
  // We use average-per-event to make it comparable across countries with different event volumes.
  function bucketRisk(name: string): number {
    const b = buckets[name];
    if (!b || b.count === 0) return 0;
    return Math.min(100, (b.rawRisk / b.count) * 10);
  }

  // ── FSI Score (12 indicators → 4 groups) ──────────────────────────────────
  const fsiCohesion  = Math.max(bucketRisk("fsi_cohesion"), 0);
  const fsiEconomic  = Math.max(bucketRisk("fsi_economic"), 0);
  const fsiPolitical = (bucketRisk("fsi_legitimacy") + bucketRisk("fsi_services") + bucketRisk("fsi_rights")) / 3;
  const fsiSocial    = (bucketRisk("fsi_social") + bucketRisk("fsi_demographic") + bucketRisk("fsi_refugees") + bucketRisk("fsi_external")) / 4;
  const fsiRisk      = (fsiCohesion * 0.30 + fsiEconomic * 0.25 + fsiPolitical * 0.25 + fsiSocial * 0.20);
  const fsiScore     = Math.round(Math.max(0, 100 - fsiRisk - positiveBonus * 0.1));

  // ── WGI Score (4 dimensions) ───────────────────────────────────────────────
  const wgiStability      = bucketRisk("wgi_stability");
  const wgiEffectiveness  = bucketRisk("wgi_effectiveness");
  const wgiAccountability = bucketRisk("wgi_accountability");
  const wgiRisk           = (wgiStability * 0.40 + wgiEffectiveness * 0.30 + wgiAccountability * 0.30);
  const wgiScore          = Math.round(Math.max(0, 100 - wgiRisk));

  // ── ACLED Score (4 metrics) ────────────────────────────────────────────────
  const acledDeadliness = bucketRisk("acled_deadliness");

  // Geographic diffusion: compute lat/lng standard deviation
  let geoDiffusion = 0;
  if (latlngs.length > 1) {
    const meanLat = latlngs.reduce((s, p) => s + p.lat, 0) / latlngs.length;
    const meanLng = latlngs.reduce((s, p) => s + p.lng, 0) / latlngs.length;
    const variance = latlngs.reduce((s, p) => s + Math.pow(p.lat - meanLat, 2) + Math.pow(p.lng - meanLng, 2), 0) / latlngs.length;
    // Normalise: stddev of ~10 degrees = max spread = 100
    geoDiffusion = Math.min(100, Math.sqrt(variance) * 10);
  }

  const acledRisk  = acledDeadliness * 0.60 + geoDiffusion * 0.40;
  const acledScore = Math.round(Math.max(0, 100 - acledRisk));

  // ── ICRG Score (3 components) ──────────────────────────────────────────────
  const icrgPolitical = bucketRisk("icrg_political");
  const icrgFinancial = bucketRisk("icrg_financial");
  const icrgEconomic  = bucketRisk("icrg_economic");
  const icrgRisk      = (icrgPolitical * 0.50 + icrgFinancial * 0.25 + icrgEconomic * 0.25);
  const icrgScore     = Math.round(Math.max(0, 100 - icrgRisk));

  // ── GPI Score (3 domains) ─────────────────────────────────────────────────
  const gpiConflict        = bucketRisk("gpi_conflict");
  const gpiSocietal        = bucketRisk("gpi_societal");
  const gpiMilitarisation  = bucketRisk("gpi_militarisation");
  const gpiRisk            = (gpiConflict * 0.40 + gpiSocietal * 0.40 + gpiMilitarisation * 0.20);
  const gpiScore           = Math.round(Math.max(0, 100 - gpiRisk));

  return {
    fsi:   Math.min(100, fsiScore),
    wgi:   Math.min(100, wgiScore),
    acled: Math.min(100, acledScore),
    icrg:  Math.min(100, icrgScore),
    gpi:   Math.min(100, gpiScore),
    breakdown: {
      // FSI sub-indicators
      fsi_cohesion:    Math.round(Math.max(0, 100 - fsiCohesion)),
      fsi_economic:    Math.round(Math.max(0, 100 - fsiEconomic)),
      fsi_political:   Math.round(Math.max(0, 100 - fsiPolitical)),
      fsi_social:      Math.round(Math.max(0, 100 - fsiSocial)),
      // WGI sub-indicators
      wgi_stability:       Math.round(Math.max(0, 100 - wgiStability)),
      wgi_effectiveness:   Math.round(Math.max(0, 100 - wgiEffectiveness)),
      wgi_accountability:  Math.round(Math.max(0, 100 - wgiAccountability)),
      // ACLED sub-indicators
      acled_deadliness: Math.round(Math.max(0, 100 - acledDeadliness)),
      acled_diffusion:  Math.round(Math.max(0, 100 - geoDiffusion)),
      // ICRG sub-indicators
      icrg_political:  Math.round(Math.max(0, 100 - icrgPolitical)),
      icrg_financial:  Math.round(Math.max(0, 100 - icrgFinancial)),
      icrg_economic:   Math.round(Math.max(0, 100 - icrgEconomic)),
      // GPI sub-indicators
      gpi_conflict:       Math.round(Math.max(0, 100 - gpiConflict)),
      gpi_societal:       Math.round(Math.max(0, 100 - gpiSocietal)),
      gpi_militarisation: Math.round(Math.max(0, 100 - gpiMilitarisation)),
    }
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type"
};

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Allow CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { country_code } = await req.json() as { country_code: string };

    if (!country_code) {
      return new Response(
        JSON.stringify({ ok: false, error: "country_code required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cc = country_code.toUpperCase();

    // Get the user's organization_id from the Auth header (if any) to include their BYOD data
    const authHeader = req.headers.get('Authorization');
    let organizationId = "00000000-0000-0000-0000-000000000001"; // Fallback to a mock test tenant
    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user && user.app_metadata?.organization_id) {
        organizationId = user.app_metadata.organization_id;
      }
    }

    // Fetch events from the past 90 days for this country
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

    const { data: events, error: fetchError } = await supabase
      .from("sentinel_events")
      .select("id, event_type, severity, occurred_at, lat, lng, organization_id")
      .eq("country_code", cc)
      .gte("occurred_at", ninetyDaysAgo)
      .not("severity", "is", null)
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .order("occurred_at", { ascending: false })
      .limit(500);

    if (fetchError) throw fetchError;

    if (!events || events.length === 0) {
      // No events — write a neutral score of 50 (unknown, not confirmed stable or unstable)
      await supabase.from("risk_scores").insert({
        country_code: cc,
        score:          50,
        security_score: 50,
        economy_score:  50,
        social_score:   50,
        fsi_score:      50,
        wgi_score:      50,
        acled_score:    50,
        icrg_score:     50,
        gpi_score:      50,
        event_count:    0,
        method_version: "v2",
        pillar_breakdown: {},
        calculated_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ ok: true, country_code: cc, score: 50, event_count: 0, note: "No events — neutral score assigned" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Compute CSI v2 ─────────────────────────────────────────────────────────
    // Load org formula (custom or default)
    const orgFormula = await loadOrgFormula(supabase, organizationId);
    const lambda       = orgFormula?.lambda    ?? LAMBDA_DEFAULT;
    const weights      = orgFormula?.weights   ?? DEFAULT_FRAMEWORK_WEIGHTS;
    const bucketMap    = orgFormula?.bucketMap ?? DEFAULT_EVENT_BUCKET_MAP;

    const { fsi, wgi, acled, icrg, gpi, breakdown } = computeFrameworkScores(events, lambda, bucketMap);

    // Weighted composite (100 = most stable)
    const compositeScore = Math.round(
      fsi   * weights.fsi   +
      wgi   * weights.wgi   +
      acled * weights.acled +
      icrg  * weights.icrg  +
      gpi   * weights.gpi
    );

    // Legacy v1 column compatibility (keep security/economy/social using old buckets,
    // but inverted to match the new scoring convention: 100 = stable)
    const securityScore = breakdown.fsi_cohesion ?? 50;
    const economyScore  = breakdown.fsi_economic  ?? 50;
    const socialScore   = breakdown.fsi_social    ?? 50;

    const { error: insertError } = await supabase.from("risk_scores").insert({
      country_code:    cc,
      score:           compositeScore,
      security_score:  securityScore,
      economy_score:   economyScore,
      social_score:    socialScore,
      fsi_score:       fsi,
      wgi_score:       wgi,
      acled_score:     acled,
      icrg_score:      icrg,
      gpi_score:       gpi,
      pillar_breakdown: breakdown,
      event_count:     events.length,
      method_version:  "v2",
      calculated_at:   new Date().toISOString(),
    });

    if (insertError) throw insertError;

    console.log(
      `CSI v2: ${cc} → ${compositeScore}/100 ` +
      `(FSI=${fsi} WGI=${wgi} ACLED=${acled} ICRG=${icrg} GPI=${gpi}) ` +
      `from ${events.length} events`
    );

    return new Response(
      JSON.stringify({ ok: true, country_code: cc, score: compositeScore, fsi, wgi, acled, icrg, gpi, event_count: events.length, breakdown }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("CSI v2 calculator error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
