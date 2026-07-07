// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LANGFUSE_HOST = Deno.env.get("LANGFUSE_HOST") || "https://cloud.langfuse.com";
const LANGFUSE_SECRET = Deno.env.get("LANGFUSE_SECRET_KEY") || "";
const LANGFUSE_PUBLIC = Deno.env.get("LANGFUSE_PUBLIC_KEY") || "";

async function lfIngest(batch: object[]) {
  if (!LANGFUSE_SECRET || !LANGFUSE_PUBLIC) return;
  try {
    const res = await fetch(`${LANGFUSE_HOST}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`)}`
      },
      body: JSON.stringify({ batch })
    });
    if (!res.ok) console.error("[Langfuse] ingest error:", res.status, await res.text());
  } catch (e) {
    console.error("[Langfuse] fetch error:", e);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let { event_id, user_prompt, bulk_events } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    let organizationId = null;
    let userId = null;
    if (authHeader) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await authClient.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: role } = await supabase.from("user_roles").select("organization_id").eq("user_id", user.id).limit(1).single();
        if (role) organizationId = role.organization_id;
      }
    }

    const traceId = crypto.randomUUID();
    await lfIngest([{ id: traceId, type: "trace-create", timestamp: new Date().toISOString(), body: { id: traceId, name: "sentinel-deep-research", userId: userId, input: { event_id, user_prompt, bulk_events } } }]);

    let event;

    if (!event_id) {
      if (!user_prompt) {
        throw new Error("Missing event_id and user_prompt. Cannot investigate nothing.");
      }

      // ── Rate limiting: max 10 virtual events per user per hour ────────────────
      if (organizationId) {
        const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
        const { count } = await supabase
          .from("sentinel_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "baseline_metric")
          .gte("ingested_at", oneHourAgo);
        if ((count ?? 0) >= 10) {
          await lfIngest([{ id: traceId, type: "trace-create", timestamp: new Date().toISOString(), body: { id: traceId, output: "rate limited" } }]);
          return new Response(
            JSON.stringify({ success: false, error: "Rate limit: max 10 custom investigations per hour." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      let targetLat = 0;
      let targetLng = 0;
      let targetCountry = null;
      let extraContext = "";
      
      if (bulk_events && bulk_events.length > 0) {
        // Calculate centroid of lassoed events
        const validEvents = bulk_events.filter((e: any) => e.lat != null && e.lng != null);
        if (validEvents.length > 0) {
          targetLat = validEvents.reduce((sum: number, e: any) => sum + e.lat, 0) / validEvents.length;
          targetLng = validEvents.reduce((sum: number, e: any) => sum + e.lng, 0) / validEvents.length;
          // Use the country of the first valid event as a fallback
          targetCountry = validEvents[0].country_code;
        }
        
        extraContext = `\n\nCONTEXT FROM ${bulk_events.length} LASSOED EVENTS:\n` + 
          bulk_events.slice(0, 10).map((e: any) => `- ${e.headline} (${e.country_code || 'Unknown'})`).join('\n') +
          (bulk_events.length > 10 ? `\n...and ${bulk_events.length - 10} more.` : "");
      }

      // Create a virtual event for global/bulk deep research
      const { data: newEvent, error: newEventErr } = await supabase
        .from("sentinel_events")
        .insert({
          headline: bulk_events && bulk_events.length > 0 
            ? `Bulk Investigation: ${bulk_events.length} regional events`
            : `Global Investigation: ${user_prompt.substring(0, 50)}...`,
          full_text: user_prompt + extraContext,
          event_type: "baseline_metric",
          severity: 5,
          occurred_at: new Date().toISOString(),
          lat: targetLat,
          lng: targetLng,
          country_code: targetCountry
        })
        .select()
        .single();
        
      if (newEventErr) throw newEventErr;
      event_id = newEvent.id;
      event = newEvent;
    } else {
      // Fetch the existing event
      const { data: existingEvent, error: eventErr } = await supabase
        .from("sentinel_events")
        .select("*")
        .eq("id", event_id)
        .single();

      if (eventErr || !existingEvent) {
        throw new Error("Event not found");
      }
      event = existingEvent;
    }

    // 0. Cache Check - ONLY IF no custom prompt is provided
    if (!user_prompt) {
      const { data: existingNodes } = await supabase
        .from("sentinel_graph_nodes")
        .select("id")
        .eq("event_id", event_id)
        .limit(1);
      
      if (existingNodes && existingNodes.length > 0) {
        console.log("Graph already exists for this event. Returning cached result.");
        await lfIngest([{ id: traceId, type: "trace-create", timestamp: new Date().toISOString(), body: { id: traceId, output: "cached" } }]);
        return new Response(JSON.stringify({ success: true, graph: { cached: true } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Initialize AI Platform
    const apiKey = Deno.env.get("FIREWORKS_API_KEY") ?? "";
    
    async function callAiPlatform(models: string[], promptText: string, spanName: string) {
      let lastError: any = null;
      for (const modelName of models) {
        console.log(`Attempting with AI Platform model: ${modelName}`);
        const genId = crypto.randomUUID();
        await lfIngest([{ id: genId, type: "generation-create", timestamp: new Date().toISOString(), body: { id: genId, traceId, name: spanName, model: modelName, input: promptText } }]);

        try {
          const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: "user", content: promptText }],
              max_tokens: 2000
            })
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`AI Platform API error: ${response.status} - ${errBody}`);
          }

          const result = await response.json();
          const text = result.choices[0].message.content.trim().replace(/^```json/, "").replace(/```$/, "");
          
          await lfIngest([{ id: genId, type: "generation-update", timestamp: new Date().toISOString(), body: { id: genId, output: text, usage: { promptTokens: result.usage?.prompt_tokens || 0, completionTokens: result.usage?.completion_tokens || 0 } } }]);
          
          return JSON.parse(text);
        } catch (err: any) {
          lastError = err;
          await lfIngest([{ id: genId, type: "generation-update", timestamp: new Date().toISOString(), body: { id: genId, level: "WARNING", statusMessage: String(err) } }]);
          console.error(`Model ${modelName} failed: ${err.message || String(err)}`);
        }
      }
      throw lastError;
    }

    // 1. TRIAGE ROUTER
    const triageModels = ["accounts/fireworks/models/deepseek-v4-flash", "accounts/fireworks/models/deepseek-v4-pro"];
    const triagePrompt = `You are a Triage Router for a Supply Chain Graph Extractor.
Evaluate the user's research request.
If the request is simple and you can easily deduce the nodes and edges from general knowledge or the headline, generate the graph and set "needs_heavy_extraction" to false.
If the event is clearly a generic satellite blip (e.g., "High Confidence Thermal Anomaly Detected") and the user request is just asking for a general map, set "needs_heavy_extraction" to false, and return a basic graph (e.g. Unknown Facility -> Location).
If the request is complex, macroeconomic, or requires finding hidden secondary/tertiary impacts of a KNOWN NAMED EVENT, set "needs_heavy_extraction" to true and output up to 3 specific keyword search queries to retrieve more context.

EVENT HEADLINE: ${event.headline}
EVENT DATE: ${event.occurred_at}
EVENT LOCATION: ${event.country_code || 'Unknown'} (Lat: ${event.lat}, Lng: ${event.lng})
USER REQUEST: ${user_prompt || "Map the supply chain impact of this event."}

Respond STRICTLY in JSON format matching this schema:
{
  "needs_heavy_extraction": boolean,
  "search_queries": ["query1", "query2"],
  "graph": {
    "nodes": [ { "label": "String", "type": "COMPANY|COUNTRY|PORT|COMMODITY" } ],
    "edges": [ { "source_label": "String", "source_type": "...", "target_label": "String", "target_type": "...", "relationship": "SUPPLIES|DEPENDS_ON|LOCATED_IN|IMPACTED_BY|MANUFACTURES", "weight": 1.0 } ]
  }
}`;

    let triageResult;
    try {
      triageResult = await callAiPlatform(triageModels, triagePrompt, "TriageRouter");
      console.log("Triage Result:", triageResult);
    } catch (e) {
      console.error("Triage failed, falling back to heavy extraction.");
      triageResult = { needs_heavy_extraction: true, search_queries: [event.headline] };
    }

    let graphData;

    if (!triageResult.needs_heavy_extraction && triageResult.graph && triageResult.graph.nodes) {
      // Triage handled it
      graphData = triageResult.graph;
      console.log("Triage router successfully generated the graph without heavy extraction.");
    } else {
      // 2. PRECISION PARALLEL RAG
      console.log("Executing Precision Parallel RAG for queries:", triageResult.search_queries);
      let extraContext = "";
      
      if (triageResult.search_queries && triageResult.search_queries.length > 0) {
        const topQuery = triageResult.search_queries[0];
        
        // Parallel fetching
        const fetchPromises = [
          supabase
            .from("sentinel_events")
            .select("headline, full_text")
            .textSearch("fts", topQuery.replace(/ /g, " & "))
            .limit(3)
        ];

        if (organizationId) {
          fetchPromises.push(
            supabase
              .from("private_knowledge")
              .select("title, content")
              .textSearch("fts", topQuery.replace(/ /g, " & "))
              .eq("organization_id", organizationId)
              .limit(3)
          );
        }

        const results = await Promise.all(fetchPromises);
        
        const publicResults = results[0].data || [];
        if (publicResults.length > 0) {
          extraContext += "\n--- PUBLIC NEWS ---\n" + publicResults.map((r: any) => `* ${r.headline}\n${(r.full_text || "").substring(0, 300)}`).join("\n\n");
        }

        if (results.length > 1) {
          const privateResults = results[1].data || [];
          if (privateResults.length > 0) {
            extraContext += "\n--- PRIVATE KNOWLEDGE ---\n" + privateResults.map((r: any) => `* ${r.title}\n${(r.content || "").substring(0, 300)}`).join("\n\n");
          }
        }
      }

      // 3. HEAVY MODEL EXTRACTION
      const heavyModels = ["accounts/fireworks/models/deepseek-v4-pro", "accounts/fireworks/models/deepseek-v4-flash"];
      const heavyPrompt = `You are the Sentinel Deep Research Agent.
Investigate the following geopolitical/supply-chain event. Look across news and financial sentiment to discover hidden secondary and tertiary consequences.
CRITICAL DIRECTIVE: The provided headline is likely generated by a generic system (e.g., using terms like "PRODUCER", "GOVERNMENT", "BUSINESS"). You MUST use your web search capabilities to search for the specific real-world event on this date in this EXACT location. Identify the EXACT specific entity (e.g., "John Deere", "Cargill") involved.
If you cannot find news for this exact location and date, DO NOT hallucinate an event from a different country. You MUST set "event_corroborated_by_news" to false, and leave the nodes and edges arrays empty.
${user_prompt ? `\nADDITIONAL DIRECTIVE: Map the supply chain specifically answering this angle: "${user_prompt}"` : ""}

EVENT DETAILS:
Headline: ${event.headline}
Source URL (if any): ${event.source_url || 'N/A'}
Date: ${event.occurred_at}
Location: ${event.city || ''} ${event.region || ''} ${event.country_code || ''} (Coordinates: Lat ${event.lat}, Lng ${event.lng})

ADDITIONAL RAG CONTEXT:
${extraContext}

Based on your deep web research and the context provided, map out the explicitly proven supply-chain topology surrounding this event.
Extract the entities (Nodes) and their relationships (Edges).

OUTPUT REQUIREMENTS:
CRITICAL: Limit your graph to a MAXIMUM of 15 most important nodes and 20 edges to keep the output concise.
Respond ONLY with a valid JSON object matching this schema. Do NOT include markdown blocks like \`\`\`json.
{
  "event_corroborated_by_news": boolean,
  "resolved_headline": "Specific Entity Name: Specific Action in Location",
  "nodes": [
    { "label": "String", "type": "COMPANY|COUNTRY|PORT|COMMODITY" }
  ],
  "edges": [
    {
      "source_label": "String",
      "source_type": "COMPANY|COUNTRY|PORT|COMMODITY",
      "target_label": "String",
      "target_type": "COMPANY|COUNTRY|PORT|COMMODITY",
      "relationship": "SUPPLIES|DEPENDS_ON|LOCATED_IN|IMPACTED_BY|MANUFACTURES",
      "weight": 1.0
    }
  ]
}`;
      
      console.log("Executing Heavy Extraction...");
      graphData = await callAiPlatform(heavyModels, heavyPrompt, "HeavyExtraction");
    }

    // Upsert into Postgres — normalise entity names before saving
    if (graphData.nodes && graphData.edges) {
      // ── 4.2 Entity Alias Normalisation ───────────────────────────────────────────
      const ENTITY_ALIASES: Record<string, string> = {
        "US": "United States", "USA": "United States", "America": "United States",
        "UK": "United Kingdom", "Britain": "United Kingdom", "Great Britain": "United Kingdom",
        "UAE": "United Arab Emirates", "KSA": "Saudi Arabia",
        "EU": "European Union", "China": "China", "PRC": "China",
        "Russia": "Russia", "RF": "Russia", "ROC": "Taiwan",
      };
      const normalise = (label: string) => ENTITY_ALIASES[label.trim()] ?? label.trim();

      // Coordinate lookup for common entities
      const KNOWN_COORDS: Record<string, [number, number]> = {
        "United States": [37.09, -95.71], "China": [35.86, 104.19], "Russia": [61.52, 105.31],
        "Germany": [51.16, 10.45], "France": [46.23, 2.21], "United Kingdom": [55.37, -3.43],
        "Japan": [36.20, 138.25], "India": [20.59, 78.96], "Brazil": [-14.23, -51.92],
        "Nigeria": [9.08, 8.67], "Ethiopia": [9.14, 40.48], "Egypt": [26.82, 30.80],
        "Sudan": [12.86, 30.21], "Kenya": [-0.02, 37.90], "South Africa": [-30.56, 22.94],
        "Saudi Arabia": [23.88, 45.07], "Iran": [32.42, 53.68], "Iraq": [33.22, 43.67],
        "Ukraine": [48.37, 31.16], "Turkey": [38.96, 35.24], "Israel": [31.04, 34.85],
        "Taiwan": [23.69, 120.96], "South Korea": [35.90, 127.76],
        "Singapore": [1.35, 103.81], "Malaysia": [4.21, 101.97], "Indonesia": [-0.78, 113.92],
        "European Union": [54.52, 15.25], "United Arab Emirates": [23.42, 53.84],
        "Port of Shanghai": [31.22, 121.48], "Port of Rotterdam": [51.94, 4.14],
        "Port of Lagos": [6.45, 3.40], "Port of Singapore": [1.29, 103.86],
        "Port of Los Angeles": [33.74, -118.26], "Suez Canal": [30.68, 32.34],
        "Strait of Hormuz": [26.56, 56.25], "Strait of Malacca": [2.50, 101.25],
        "Taiwan Strait": [24.46, 119.53],
        "TSMC": [24.78, 120.99], "Samsung": [37.52, 127.02], "Foxconn": [22.65, 114.06],
        "Saudi Aramco": [26.91, 49.62],
      };

      graphData.nodes = graphData.nodes.map((n: any) => {
        const label = normalise(n.label);
        const coords = KNOWN_COORDS[label];
        return { ...n, label, lat: coords ? coords[0] : null, lng: coords ? coords[1] : null };
      });
      graphData.edges = graphData.edges.map((e: any) => ({
        ...e,
        source_label: normalise(e.source_label),
        target_label: normalise(e.target_label),
      }));

      // Build coord index for edge reconstruction on the frontend
      const nodeCoordIndex: Record<string, [number, number] | null> = {};
      for (const n of graphData.nodes) {
        nodeCoordIndex[n.label] = (n.lat != null && n.lng != null) ? [n.lat, n.lng] : null;
      }

      const { error: upsertErr } = await supabase.rpc("upsert_graph_subnetwork", {
        p_event_id: event_id,
        p_nodes: graphData.nodes,
        p_edges: graphData.edges
      });

      if (upsertErr) {
        console.error("RPC Error:", upsertErr);
        throw upsertErr;
      }
      
      // Update the event with the resolved headline and mark it as deeply researched
      const aiAnalysis = event.ai_analysis || {};
      aiAnalysis.deep_researched = true;
      
      // ONLY overwrite the headline if the event was successfully corroborated by real news!
      if (graphData.event_corroborated_by_news !== false && graphData.resolved_headline) {
        aiAnalysis.original_headline = event.headline;
      }
      
      const { error: eventUpdateErr } = await supabase
        .from("sentinel_events")
        .update({
          headline: (graphData.event_corroborated_by_news !== false && graphData.resolved_headline) ? graphData.resolved_headline : event.headline,
          ai_analysis: aiAnalysis
        })
        .eq("id", event_id);
        
      if (eventUpdateErr) {
        console.error("Failed to update event headline:", eventUpdateErr);
      }
    }

    // Give a generic response for uncorroborated satellite events
    if (graphData && graphData.event_corroborated_by_news === false) {
       graphData.nodes = [{ label: "Unknown Local Facility", type: "COMPANY" }, { label: event.country_code || "Unknown", type: "COUNTRY" }];
       graphData.edges = [{ source_label: "Unknown Local Facility", source_type: "COMPANY", target_label: event.country_code || "Unknown", target_type: "COUNTRY", relationship: "LOCATED_IN", weight: 1.0 }];
       graphData.resolved_headline = "Localized Event: " + event.headline;
    }

    await lfIngest([{ id: traceId, type: "trace-create", timestamp: new Date().toISOString(), body: { id: traceId, output: graphData } }]);
    return new Response(JSON.stringify({ success: true, graph: graphData, event_id: event_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Deep Research Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

