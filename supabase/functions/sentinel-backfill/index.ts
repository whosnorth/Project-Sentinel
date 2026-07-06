// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: events, error: fetchError } = await supabase
      .from("sentinel_events")
      .select("id, headline, event_type, country_code, ai_analysis")
      .is("embedding", null)
      .limit(100);

    if (fetchError) {
      throw fetchError;
    }

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ processed: 0, remaining: 0, message: "All events embedded!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    const inputTexts = events.map(event => `Event: ${event.headline}\nType: ${event.event_type}\nLocation: ${event.country_code || "Global"}\nAnalysis: `);
    const res = await fetch(`https://api.fireworks.ai/inference/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FIREWORKS_API_KEY}` },
      body: JSON.stringify({ model: "nomic-ai/nomic-embed-text-v1.5", input: inputTexts })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        for (let i = 0; i < events.length; i++) {
          const embedding = json.data[i]?.embedding || null;
          const { error: updateError } = await supabase.from("sentinel_events").update({ embedding }).eq("id", events[i].id);
          if (!updateError) processed++;
        }
      }
    }

    return new Response(JSON.stringify({ processed, remaining: events.length - processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

