// sentinel-chat-query: RAG chatbot endpoint for the Intel Chat sidebar.
// 1. LLM Router: Extracts structured filters from the user query
// 2. Embeds the user query with nomic-ai/nomic-embed-text-v1.5
// 3. Queries sentinel_events via hybrid_search_events (RPC)
// 4. Calls ai 2.5 Flash with injected context to generate a response
// Deploy as: npx supabase functions deploy sentinel-chat-query

// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY")!;
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*"; // Restrict in production

const LANGFUSE_HOST = Deno.env.get("LANGFUSE_HOST") || "https://cloud.langfuse.com";
const LANGFUSE_SECRET = Deno.env.get("LANGFUSE_SECRET_KEY") || "";
const LANGFUSE_PUBLIC = Deno.env.get("LANGFUSE_PUBLIC_KEY") || "";

// Lightweight Langfuse REST helper — works reliably in Deno edge functions.
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

function lfTraceEvent(traceId: string, userId: string, name: string, input: any) {
  return { id: traceId, type: "trace-create", timestamp: new Date().toISOString(), body: { id: traceId, name, userId, input } };
}

function lfGenerationStart(id: string, traceId: string, name: string, model: string, input: any) {
  return { id, type: "generation-create", timestamp: new Date().toISOString(), body: { id, traceId, name, model, input } };
}

function lfGenerationEnd(id: string, output: any, usage?: { promptTokens: number; completionTokens: number }, level?: string, statusMessage?: string) {
  return { id, type: "generation-update", timestamp: new Date().toISOString(), body: { id, output, usage, level, statusMessage } };
}

function lfTraceUpdate(traceId: string, output: any) {
  return { id: traceId, type: "trace-create", timestamp: new Date().toISOString(), body: { id: traceId, output } };
}

const FIREWORKS_BASE = "https://api.fireworks.ai/inference/v1";
const FALLBACK_MODELS = [
  "accounts/fireworks/models/glm-5p2",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extracts structured filters from the user query using AI Platform
async function extractFilters(query: string, traceId?: string) {
  const prompt = `You are a query router. The current date is ${new Date().toISOString().split('T')[0]}.
Extract filters from the user's query about geopolitical/supply chain events.
Output ONLY a valid JSON object matching this schema, no markdown blocks:
{
  "country_code": "2-letter ISO code or 'GLOBAL' if the query asks for global/world/international events, or null if not specified",
  "start_date": "ISO timestamp (e.g. '2026-05-01T00:00:00Z') based on relative terms like 'last month', 'this year', or null",
  "end_date": "ISO timestamp, or null",
  "min_severity": integer between 1 and 5 (e.g., if they ask for 'severe', 'critical', 'major' events, use 4 or 5), or null
}
User Query: "${query}"`;

  const genId = crypto.randomUUID();
  if (traceId) await lfIngest([lfGenerationStart(genId, traceId, "extractFilters", "accounts/fireworks/models/glm-5p2", prompt)]);

  try {
    const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "accounts/fireworks/models/glm-5p2",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 500
      })
    });
    
    if (!res.ok) throw new Error(`AI Platform Error: ${await res.text()}`);
    
    const data = await res.json();
    let text = data.choices?.[0]?.message?.content;

    if (traceId) await lfIngest([lfGenerationEnd(genId, text, { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0 })]);

    if (!text) return {};
    
    text = text.trim().replace(/^```json/, "").replace(/```$/, "");
    return JSON.parse(text);
  } catch (err) {
    if (traceId) await lfIngest([lfGenerationEnd(genId, null, undefined, "ERROR", String(err))]);
    console.error("Filter extraction failed:", err);
    return {};
  }
}

// --- EMBEDDING ---
async function embedQuery(query: string): Promise<number[]> {
  const res = await fetch("https://api.fireworks.ai/inference/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "nomic-ai/nomic-embed-text-v1.5",
      input: query
    })
  });
  if (!res.ok) throw new Error(`Embedding API Error: ${await res.text()}`);
  const data = await res.json();
  return data.data?.[0]?.embedding || [];
}

// --- CHAT GENERATOR ---
async function callAiChat(prompt: string, historyMessages: {role: string; content: string}[] = [], traceId?: string): Promise<string> {
  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS) {
    const genId = crypto.randomUUID();
    if (traceId) await lfIngest([lfGenerationStart(genId, traceId, "callAiChat", modelName, [{role: "system", content: prompt}, ...historyMessages])]);

    try {
      const messages = [
        ...historyMessages,
        { role: "user", content: prompt }
      ];

      const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.3,
          max_tokens: 32000
        })
      });

      if (!res.ok) {
        throw new Error(`AI Platform Chat API Error: ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "No response generated.";
      
      if (traceId) await lfIngest([lfGenerationEnd(genId, content, { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0 })]);
      
      return content;
    } catch (err: any) {
      if (traceId) await lfIngest([lfGenerationEnd(genId, null, undefined, "WARNING", String(err))]);
      console.error(`Chat cascade model ${modelName} failed:`, err);
      lastError = err;
    }
  }

  throw new Error(`All chat models failed. Last error: ${lastError?.message || String(lastError)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const authHeader = req.headers.get("Authorization");
  let userId = "00000000-0000-0000-0000-000000000000"; // Default for anon/service role

  if (authHeader) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token !== SUPABASE_SERVICE_KEY) {
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await authClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }
  }

  try {
    const { query, country_code, event_context, bulk_events, conversation_history } = await req.json() as {
      query: string;
      country_code?: string;
      event_context?: any;
      bulk_events?: any[];
      conversation_history?: { role: string; content: string }[];
    };

    if (!query?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "query required" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    const traceId = crypto.randomUUID();
    await lfIngest([lfTraceEvent(traceId, userId, "sentinel-chat-query", query)]);

    console.log(`[Hybrid Search] Processing query: "${query}" for user ${userId}`);

    let relevantEvents = bulk_events || [];

    // Perform background hybrid search for historical context.
    if (!bulk_events || bulk_events.length === 0) {
      // ── Step 1: LLM Router & Embedding (Parallel) ─────────────────────────
      const searchContext = event_context?.headline ? `${query} (Context: ${event_context.headline})` : query;
      const [filters, queryEmbedding] = await Promise.all([
        extractFilters(query, traceId),
        embedQuery(searchContext)
      ]);

      const finalCountry = filters.country_code === 'GLOBAL' 
        ? null 
        : (filters.country_code || country_code || event_context?.country_code);

      console.log(`[Hybrid Search] Filters:`, { ...filters, country_code: finalCountry });

      // ── Step 2: Hybrid RPC Execution ──────────────────────────────────────
      // To prevent 'statement timeout' in Postgres full-text search, we shouldn't pass massive prompts like "Write a high-level..." into websearch_to_tsquery.
      const optimizedQueryText = event_context?.headline ? event_context.headline : (query.length > 60 ? query.substring(0, 60) : query);

      const { data: dbEvents, error: dbErr } = await supabase.rpc('hybrid_search_events', {
        p_query_text: optimizedQueryText,
        p_query_embedding: queryEmbedding,
        p_match_count: 50, // Top 50 instead of 100 to save time and tokens
        p_country_code: finalCountry || null,
        p_start_date: filters.start_date || null,
        p_end_date: filters.end_date || null,
        p_min_severity: filters.min_severity || null,
        p_organization_id: "00000000-0000-0000-0000-000000000001" // Hardcoded test org id (matching ingest mock)
      });

      if (dbErr) throw dbErr;
      relevantEvents = dbEvents || [];
    }

    // ── Step 3: Build Markdown context and generate response ──────────────────
    function eventsToMarkdown(events: any[]): string {
      if (!events || events.length === 0) return "No relevant events found.";
      return events.map(e => `
### Event: ${e.headline}
* **Date:** ${new Date(e.occurred_at).toLocaleDateString("en-GB")}
* **Location:** ${e.country_code || 'Global'}
* **Type:** ${e.event_type}
* **Severity:** ${e.severity}/10
* **Analysis:** ${e.ai_analysis?.supply_chain_impact || e.full_text || "No AI analysis available"}
      `).join("\n---\n");
    }
    
    const markdownPayload = eventsToMarkdown(relevantEvents);

    let focusedEventStr = "";
    let deterministicGraphStr = "";
    
    if (bulk_events && bulk_events.length > 0) {
      focusedEventStr = `
=== USER SELECTED BULK REGION ===
The user explicitly lassoed ${bulk_events.length} events on the map. Your ABSOLUTE primary directive is to analyze these specific events to answer the user's prompt. 
Do not ignore them.
=================================
`;
    } else if (event_context) {
      if (event_context.id) {
        const { data: graphMd, error: graphErr } = await supabase.rpc('get_event_impact_markdown', { p_event_id: event_context.id, p_max_depth: 3 });
        if (!graphErr && graphMd) {
          deterministicGraphStr = `\n=== DETERMINISTIC GRAPH ===\nHere is the explicit, mathematically-proven subgraph of entities connected to this event. DO NOT hallucinate relationships; rely on this graph:\n${graphMd}\n===========================\n`;
        }
      }

      focusedEventStr = `
=== PRIMARY FOCUSED EVENT ===
The user explicitly clicked on this event in their dashboard. Frame your answer around this specific context:
HEADLINE: ${event_context.headline || "Unknown"}
TYPE: ${event_context.event_type || "Unknown"}
SEVERITY: ${event_context.severity || "Unknown"}/10
ANALYSIS: ${JSON.stringify(event_context.ai_analysis || {})}
SOURCE URL: ${event_context.source_url || "Unknown"}
ARTICLE TEXT: ${event_context.full_text ? event_context.full_text.substring(0, 3000) : "Not available"}
=============================
`;
    }

    const systemPrompt = `You are Sentinel, an elite geopolitical intelligence analyst serving institutional clients (hedge funds, multinationals). You have access to real-time event data from GDELT, ACLED, NASA FIRMS, and AI-enriched supply chain intelligence.
You also have access to live internet cross-referencing capabilities.

CRITICAL INSTRUCTION:
Before answering, you MUST map out the geopolitical and supply chain cascades internally using a <thought_process> block. Think 2 to 3 steps ahead. What downstream industries starve? What alternative routes get congested? 
After your thought process, provide the final response in a <final_assessment> block.

Your response MUST exactly follow this structure:
<thought_process>
1. Immediate Event: ...
2. Secondary Geopolitical Impact: ...
3. Tertiary Supply Chain Cascade: ...
</thought_process>

<final_assessment>
[Your highly professional, C-suite intelligence brief here. Reference specific events from context. Quantify impacts where possible.]
</final_assessment>

PRIORITY GROUNDING RULES:
1. If a PRIMARY FOCUSED EVENT is provided, it is your ABSOLUTE source of truth. Your answer MUST be framed entirely around it.
2. The HISTORICAL / BACKGROUND EVENTS section contains separate, past events retrieved from the database to provide historical context. They are NOT the primary events you are analyzing. Do not confuse them with the events in your Primary Focused Event.
3. ONLY use your Google Search tool to fill in external blanks (e.g., live stock prices, latest news not in context) to avoid redundant searches and save compute.

${focusedEventStr}
${deterministicGraphStr}

HISTORICAL / BACKGROUND EVENTS FROM DATABASE (Markdown):
${markdownPayload}

USER QUERY: ${query}

If the context is empty, state that no relevant events were found, and answer based on general knowledge if possible.`;

    // Build message history for multi-turn conversation context
    const historyMessages = (conversation_history || []).slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const rawAnswer = await callAiChat(systemPrompt, historyMessages, traceId);
    
    // Extract only the final assessment for the UI
    let answer = rawAnswer;
    if (answer.includes("<final_assessment>")) {
      answer = answer.split("<final_assessment>")[1];
    } else if (answer.includes("</thought_process>")) {
      answer = answer.split("</thought_process>")[1];
    } else if (answer.includes("<thought_process>")) {
      answer = "*(The intelligence brief was interrupted or timed out. Partial thought process below)*\n\n" + answer;
    }
    
    answer = answer.replace(/<final_assessment>/g, "").replace(/<\/final_assessment>/g, "").trim();

    // Extract exact source URLs for grounding
    const sources = (relevantEvents || [])
      .filter((e: any) => e.source_url)
      .slice(0, 5)
      .map((e: any) => ({
        label: `[${(e.event_type || 'UNKNOWN').toUpperCase()}] ${e.headline ? e.headline.substring(0, 40) + '...' : 'Sentinel Report'}`,
        url: e.source_url
      }));

    if (event_context?.source_url) {
      const exists = sources.find((s: any) => s.url === event_context.source_url);
      if (!exists) {
        sources.unshift({
          label: `[FOCUSED EVENT] ${event_context.headline ? event_context.headline.substring(0, 40) + '...' : 'Sentinel Report'}`,
          url: event_context.source_url
        });
      }
    }

    await lfIngest([lfTraceUpdate(traceId, answer)]);

    return new Response(
      JSON.stringify({ ok: true, answer, sources, event_count: relevantEvents?.length || 0 }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Chat query error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

