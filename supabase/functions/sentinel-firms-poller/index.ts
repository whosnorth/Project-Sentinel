// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mappings from MAP_KEY to endpoint
// https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/VIIRS_SNPP_NRT/world/1
// VIIRS SNPP provides good coverage. We can query 'world' for the past 1 day.

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const MAP_KEY = Deno.env.get('FIRMS_API_KEY');
    if (!MAP_KEY) {
      throw new Error('FIRMS_API_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch from FIRMS API: global SNPP NRT for the last 1 day
    console.log('Fetching NASA FIRMS data...');
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_SNPP_NRT/world/1`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch FIRMS data: ${response.statusText}`);
    }

    const csvText = await response.text();
    console.log("CSV Preview:", csvText.substring(0, 500));
    // Parse simple CSV (header row + data)
    const lines = csvText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      return new Response(JSON.stringify({ message: "No data found", count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = lines[0].split(',');
    
    // Process anomalies
    let insertedCount = 0;
    const events = [];

    // Parse each line (skipping header)
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < headers.length) continue;

      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      const bright_ti4 = parseFloat(parts[2]);
      const acq_date = parts[5];
      const acq_time = parts[6]; // e.g. "1245" for 12:45
      const confidence = parts[9]; // 'l', 'n', 'h' (low, nominal, high)
      
      // confidence is 'l', 'n', 'h' for MODIS, but for VIIRS it's 'n' or 'h'.
      if (confidence !== 'h' && confidence !== 'n') continue;
      
      // We want to skip low-intensity fires (e.g. routine flaring/farming)
      // Brightness > 310 K is a safer threshold to ensure we get some data
      if (bright_ti4 < 310) continue;

      // Construct timestamp
      const paddedTime = acq_time.padStart(4, '0');
      const hours = paddedTime.substring(0, 2);
      const minutes = paddedTime.substring(2, 4);
      const occurred_at = new Date(`${acq_date}T${hours}:${minutes}:00Z`).toISOString();

      let country_code = 'GL';
      // Basic bounding box mappings for African countries
      if (lat >= 4.0 && lat <= 14.0 && lng >= 2.0 && lng <= 15.0) country_code = 'NG'; // Nigeria
      else if (lat >= 10.0 && lat <= 25.0 && lng >= -12.0 && lng <= 5.0) country_code = 'ML'; // Mali
      else if (lat >= 9.0 && lat <= 15.0 && lng >= -6.0 && lng <= 3.0) country_code = 'BF'; // Burkina Faso
      else if (lat >= 11.0 && lat <= 24.0 && lng >= 0.0 && lng <= 16.0) country_code = 'NE'; // Niger
      else if (lat >= 12.0 && lat <= 24.0 && lng >= 13.0 && lng <= 24.0) country_code = 'CD'; // Chad
      else if (lat >= -5.0 && lat <= 15.0 && lng >= 8.0 && lng <= 16.0) country_code = 'CM'; // Cameroon
      else if (lat >= 25.0 && lat <= 50.0 && lng >= -15.0 && lng <= 45.0) country_code = 'EU'; // Europe/Mediterranean
      else if (lat >= -35.0 && lat <= -20.0 && lng >= 15.0 && lng <= 35.0) country_code = 'ZA'; // South Africa

      events.push({
        source_url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng},${lat},10z`,
        headline: `High Confidence Thermal Anomaly Detected (Brightness: ${bright_ti4}K)`,
        event_type: 'infrastructure',
        severity: bright_ti4 > 350 ? 8 : 6, // Map brightness roughly to severity
        occurred_at,
        lat,
        lng,
        country_code,
        full_text: `Satellite overpass detected a high-confidence thermal footprint at coordinates [${lat}, ${lng}]. This may indicate an industrial explosion, pipeline fire, or severe environmental crisis.`,
        raw_gdelt: {
          lat, lng, bright_ti4, confidence, acq_date, acq_time
        }
      });
    }

    // Limit batch size but prioritize events in target countries (e.g. Nigeria)
    events.sort((a, b) => {
      if (a.country_code === 'NG' && b.country_code !== 'NG') return -1;
      if (b.country_code === 'NG' && a.country_code !== 'NG') return 1;
      return b.raw_gdelt.bright_ti4 - a.raw_gdelt.bright_ti4;
    });
    const toInsert = events.slice(0, 2500);

    console.log(`Prepared ${toInsert.length} high-confidence thermal events for insertion.`);

    if (toInsert.length > 0) {
      const { error } = await supabaseClient
        .from('sentinel_events')
        .upsert(toInsert, { onConflict: 'source_url' });

      if (error) throw error;
      insertedCount = toInsert.length;
    }

    // verify if they are in DB
    const { count } = await supabaseClient
      .from('sentinel_events')
      .select('*', { count: 'exact', head: true })
      .in('event_type', ['infrastructure', 'environmental']);

    return new Response(JSON.stringify({ 
      message: "FIRMS polling completed", 
      high_confidence_anomalies: insertedCount,
      total_in_db: count
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in FIRMS poller:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

