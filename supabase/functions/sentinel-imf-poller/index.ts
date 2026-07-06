// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import iso from "https://esm.sh/i18n-iso-countries@7.11.1";
import en from "https://esm.sh/i18n-iso-countries@7.11.1/langs/en.json" assert { type: "json" };

iso.registerLocale(en);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMF_BASE_URL = "https://www.imf.org/external/datamapper/api/v1";

async function fetchIMFIndicator(indicator: string) {
  try {
    const res = await fetch(`${IMF_BASE_URL}/${indicator}`);
    if (!res.ok) throw new Error(`Failed to fetch ${indicator}`);
    const data = await res.json();
    return data.values?.[indicator] || {};
  } catch (error) {
    console.error(`Error fetching IMF indicator ${indicator}:`, error);
    return {};
  }
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

    console.log("Fetching IMF macroeconomic baseline indicators...");

    // Fetch indicators in parallel
    const [gdpData, inflationData, currentAccountData, debtData, countriesRes] = await Promise.all([
      fetchIMFIndicator("NGDP_RPCH"),      // Real GDP Growth
      fetchIMFIndicator("PCPIPCH"),        // Inflation Rate
      fetchIMFIndicator("BCA_NGDPD"),      // Current Account Balance
      fetchIMFIndicator("GGXWDG_NGDP"),    // Government Gross Debt
      fetch(`${IMF_BASE_URL}/countries`).then(res => res.json())
    ]);

    const imfCountries = countriesRes?.countries || {};
    const countries = new Map<string, any>();

    const getLatestValue = (countryData: any) => {
      if (!countryData) return null;
      const years = Object.keys(countryData).sort((a, b) => Number(b) - Number(a));
      for (const year of years) {
        if (countryData[year] !== null && countryData[year] !== "") {
          return Number(countryData[year]);
        }
      }
      return null;
    };

    // Iterate over all countries defined in IMF
    for (const [imfCode, countryInfo] of Object.entries(imfCountries)) {
      // IMF uses ISO-3 alpha codes for many countries
      let iso2 = iso.alpha3ToAlpha2(imfCode);
      if (!iso2) {
        // Fallback for regions or if it's already an iso2 somehow
        if (imfCode.length === 2) iso2 = imfCode;
        else continue;
      }

      const gdp = getLatestValue(gdpData[imfCode]);
      const inflation = getLatestValue(inflationData[imfCode]);
      const currentAccount = getLatestValue(currentAccountData[imfCode]);
      const debt = getLatestValue(debtData[imfCode]);

      if (gdp === null && inflation === null && currentAccount === null && debt === null) {
        continue; // No data at all
      }

      countries.set(iso2, {
        iso2_code: iso2,
        country_name: countryInfo.label || iso.getName(iso2, "en") || iso2,
        imf_gdp_growth: gdp,
        imf_inflation_rate: inflation,
        imf_current_account_balance: currentAccount,
        imf_gov_gross_debt: debt,
        last_updated: new Date().toISOString()
      });
    }

    const metadataToUpsert = Array.from(countries.values());
    const eventsToProcess = [];

    for (const metrics of metadataToUpsert) {
      // Calculate severity primarily based on Inflation, Debt, and GDP Growth.
      // High inflation (>10), high debt (>100%), negative GDP growth = High Severity
      let severity = 5; // Moderate default
      
      let vulnerabilityPoints = 0;
      if (metrics.imf_inflation_rate !== null) {
        if (metrics.imf_inflation_rate > 50) vulnerabilityPoints += 5;
        else if (metrics.imf_inflation_rate > 10) vulnerabilityPoints += 3;
        else if (metrics.imf_inflation_rate > 5) vulnerabilityPoints += 1;
        else if (metrics.imf_inflation_rate < 0) vulnerabilityPoints += 2; // Deflation risk
      }

      if (metrics.imf_gov_gross_debt !== null) {
        if (metrics.imf_gov_gross_debt > 130) vulnerabilityPoints += 4;
        else if (metrics.imf_gov_gross_debt > 80) vulnerabilityPoints += 2;
      }

      if (metrics.imf_gdp_growth !== null) {
        if (metrics.imf_gdp_growth < -5) vulnerabilityPoints += 4;
        else if (metrics.imf_gdp_growth < 0) vulnerabilityPoints += 2;
        else if (metrics.imf_gdp_growth > 3) vulnerabilityPoints -= 1;
      }

      if (metrics.imf_current_account_balance !== null) {
        if (metrics.imf_current_account_balance < -10) vulnerabilityPoints += 2;
      }

      severity = Math.min(10, Math.max(1, 1 + vulnerabilityPoints));

      const headline = `Macroeconomic Baseline Financial Statistics: ${metrics.country_name}`;
      
      const gdpText = metrics.imf_gdp_growth !== null ? `Real GDP Growth is ${metrics.imf_gdp_growth.toFixed(2)}%.` : "";
      const infText = metrics.imf_inflation_rate !== null ? `Inflation Rate is ${metrics.imf_inflation_rate.toFixed(2)}%.` : "";
      const debtText = metrics.imf_gov_gross_debt !== null ? `Government Gross Debt is ${metrics.imf_gov_gross_debt.toFixed(2)}% of GDP.` : "";
      const currentAccountText = metrics.imf_current_account_balance !== null ? `Current Account Balance is ${metrics.imf_current_account_balance.toFixed(2)}% of GDP.` : "";

      const full_text = `CRITICAL MACROECONOMIC BASELINE: ${infText} ${gdpText} SECONDARY METRICS: ${debtText} ${currentAccountText} This financial baseline provides context on the underlying economic stability and vulnerability of ${metrics.country_name}.`;

      eventsToProcess.push({
        source_url: `imf-baseline-${metrics.iso2_code}`,
        headline,
        event_type: 'baseline_metric',
        severity,
        occurred_at: new Date().toISOString(),
        country_code: metrics.iso2_code,
        full_text,
        raw_gdelt: metrics 
      });
    }

    console.log(`Processed IMF metrics for ${metadataToUpsert.length} countries.`);

    if (metadataToUpsert.length > 0) {
      console.log("Upserting raw indicators into country_metadata...");
      // UPSERT country metadata. We use upsert on iso2_code.
      // Since worldbank and IMF functions might overwrite each other's fields if not careful, we should only update the IMF fields if the row exists, but Supabase upsert will overwrite non-specified fields to default if we aren't careful?
      // Actually, Supabase standard upsert updates only the fields provided. So it won't overwrite wb_lpi_score if it's already there!
      const { error: metaError } = await supabase
        .from('country_metadata')
        .upsert(metadataToUpsert, { onConflict: 'iso2_code' });
      
      if (metaError) {
         console.warn("Failed to upsert country_metadata, ensuring table exists:", metaError);
      }
    }

    if (eventsToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No data found." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Generate Embeddings ───────────────────────────────────
    console.log("Generating Vector Embeddings for IMF Baselines...");
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
      message: "IMF baseline polling completed", 
      events_inserted: eventsToProcess.length,
      metadata_updated: metadataToUpsert.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in IMF poller:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});


