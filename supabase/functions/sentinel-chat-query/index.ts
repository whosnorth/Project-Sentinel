// sentinel-chat-query: RAG chatbot endpoint for the Intel Chat sidebar.
// 1. LLM Router: Extracts structured filters from the user query
// 2. Embeds the user query with nomic-ai/nomic-embed-text-v1.5
// 3. Queries sentinel_events via hybrid_search_events (RPC)
// 4. Temporal bypass: if query mentions "today"/"now", fetches last 24h events directly
// 5. Calls DeepSeek V4 Pro with injected context + optional search_web tool
// 6. Agentic loop: if model calls search_web, executes via Tavily/Serper and re-calls
// Deploy as: npx supabase functions deploy sentinel-chat-query

// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY")!;
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") || "";
const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY") || "";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

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

// ── Temporal Intent Detection ─────────────────────────────────────────────────
// Detects time-relative queries so we can bypass semantic search and do a
// direct timestamp-ordered fetch from sentinel_events instead.
const TEMPORAL_PATTERNS = [
  /\btoday\b/i, /\bright now\b/i, /\bcurrent(ly)?\b/i,
  /\blast (24|12|6|48|72)( )?hours?\b/i,
  /\bpast (24|12|6|48|72)( )?hours?\b/i,
  /\bthis (morning|afternoon|evening|week)\b/i,
  /\blatest\b/i, /\brecent(ly)?\b/i, /\blive\b/i, /\bnow\b/i,
];

function detectTemporalHours(query: string): number | null {
  if (/\b(6[ ]?hours?|last 6)\b/i.test(query)) return 6;
  if (/\b(12[ ]?hours?|last 12)\b/i.test(query)) return 12;
  if (/\b(48[ ]?hours?|last 48|yesterday|past 2 days?)\b/i.test(query)) return 48;
  if (/\b(72[ ]?hours?|last 72|past 3 days?)\b/i.test(query)) return 72;
  if (/\bthis week\b/i.test(query)) return 168;
  if (TEMPORAL_PATTERNS.some(p => p.test(query))) return 24; // default: 24h
  return null;
}

// ── Web Search: Tavily (primary) → Serper (fallback) ─────────────────────────
async function executeWebSearch(
  query: string,
  supabase: any,
  userId: string,
  organizationId: string,
  sessionId: string
): Promise<{ text: string; urls: string[]; provider: string }> {
  const start = Date.now();
  let provider = "none";
  let resultCount = 0;
  let succeeded = true;
  let errorMsg: string | null = null;
  let text = "";
  const urls: string[] = [];

  try {
    // ── Try Tavily first (AI-optimised, returns pre-summarised results) ────
    if (TAVILY_API_KEY) {
      provider = "tavily";
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY_API_KEY}` },
        body: JSON.stringify({
          query,
          search_depth: "basic",
          max_results: 5,
          include_answer: true,
          include_raw_content: false,
        })
      });
      if (res.ok) {
        const data = await res.json();
        resultCount = data.results?.length ?? 0;
        // Tavily returns a pre-synthesised answer — inject it first
        const parts: string[] = [];
        if (data.answer) parts.push(`SUMMARY: ${data.answer}`);
        (data.results ?? []).slice(0, 5).forEach((r: any, i: number) => {
          parts.push(`[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.substring(0, 300) ?? ""}`);
          urls.push(r.url);
        });
        text = parts.join("\n\n---\n\n");
      } else {
        console.warn(`[WebSearch] Tavily failed (${res.status}), falling back to Serper`);
        throw new Error(`Tavily HTTP ${res.status}`);
      }
    } else {
      throw new Error("No Tavily key — skip to Serper");
    }
  } catch (tavErr) {
    // ── Fallback: Serper (Google Search JSON API) ─────────────────────────
    try {
      if (SERPER_API_KEY) {
        provider = "serper";
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-KEY": SERPER_API_KEY },
          body: JSON.stringify({ q: query, num: 5 })
        });
        if (!res.ok) throw new Error(`Serper HTTP ${res.status}`);
        const data = await res.json();
        const results = data.organic ?? [];
        resultCount = results.length;
        text = results.slice(0, 5).map((r: any, i: number) => {
          urls.push(r.link);
          return `[${i + 1}] ${r.title}\nURL: ${r.link}\n${r.snippet ?? ""}`;
        }).join("\n\n---\n\n");
      } else {
        provider = "none";
        text = "Web search unavailable: no search API keys configured.";
        succeeded = false;
      }
    } catch (serperErr: any) {
      provider = "failed";
      text = `Web search failed on all providers: ${serperErr.message}`;
      succeeded = false;
      errorMsg = serperErr.message;
    }
  }

  // ── Audit log: fire-and-forget, never blocks the response ─────────────
  supabase.from("sentinel_tool_audit").insert({
    organization_id: organizationId === "00000000-0000-0000-0000-000000000001" ? null : organizationId,
    user_id: userId === "00000000-0000-0000-0000-000000000000" ? null : userId,
    session_id: sessionId,
    tool_name: "search_web",
    tool_input: { query },
    tool_provider: provider,
    result_count: resultCount,
    latency_ms: Date.now() - start,
    succeeded,
    error_message: errorMsg,
  }).then(() => {}).catch((e: any) => console.warn("[Audit] Failed to log tool call:", e));

  return { text, urls, provider };
}

// ── Check if web search is enabled for this org ───────────────────────────────
async function isWebSearchEnabled(supabase: any, organizationId: string, hasByodData: boolean): Promise<boolean> {
  // Platform test org and orgs without BYOD data: web search enabled by default
  if (organizationId === "00000000-0000-0000-0000-000000000001" || !hasByodData) return true;

  // BYOD orgs: must explicitly opt-in
  const { data } = await supabase
    .from("org_web_search_settings")
    .select("web_search_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data?.web_search_enabled ?? false; // Default: disabled for BYOD orgs
}

// ── Tool definition for DeepSeek V4 Pro ───────────────────────────────────────
const SEARCH_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: `Search the live web for real-time information not present in Sentinel's event database.
Use ONLY when:
- A specific breaking fact from the last 1-2 hours is absent from the RAG context
- You need a precise live statistic (e.g. current oil price, latest UN resolution)
- You need to verify a specific named entity or figure not in the context
DO NOT use for:
- General geopolitical knowledge you already have from training data
- Information already present in the provided event context
- Broad overviews (use RAG context instead)`,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "A precise, targeted search query. Be specific: 'Houthi Red Sea attack 12 July 2026' not 'recent attacks'"
          },
          reason: {
            type: "string",
            description: "One sentence: why is this search needed? What specific gap does it fill?"
          }
        },
        required: ["query", "reason"]
      }
    }
  }
];

const FIREWORKS_BASE = "https://api.fireworks.ai/inference/v1";
const FALLBACK_MODELS = [
  "accounts/fireworks/models/deepseek-v4-pro",
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
  if (traceId) await lfIngest([lfGenerationStart(genId, traceId, "extractFilters", "accounts/fireworks/models/deepseek-v4-flash", prompt)]);

  try {
    const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "accounts/fireworks/models/deepseek-v4-flash",
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

// ── AGENTIC CHAT GENERATOR (with tool-calling loop) ──────────────────────────
// Supports up to 1 tool-call iteration. On each iteration:
// - If model returns text: done.
// - If model returns tool_calls: execute search, inject result, loop once.
// A 45-second deadline guard ensures graceful degradation before the
// Supabase Edge Function 60s hard kill kicks in.
async function callAiChat(
  systemPrompt: string,
  historyMessages: {role: string; content: string}[],
  tools: any[],
  webSearchCtx: { supabase: any; userId: string; organizationId: string; sessionId: string },
  traceId?: string
): Promise<{ content: string; webUrls: string[] }> {
  let lastError: any = null;
  const collectedWebUrls: string[] = [];
  // Hard deadline: 45 seconds from function entry, leaving 15s buffer before
  // Supabase's 60s wall-clock kill. If exceeded, return a graceful message.
  const deadline = Date.now() + 45_000;

  const messages: any[] = [
    ...historyMessages,
    { role: "user", content: systemPrompt }
  ];

  for (const modelName of FALLBACK_MODELS) {
    // Max 1 tool-call iteration — one web search round is sufficient.
    // Two rounds compounds latency and reliably hits the 60s edge function limit.
    for (let iteration = 0; iteration < 1; iteration++) {
      // ── Deadline guard: bail out gracefully before Supabase kills us ──────
      if (Date.now() > deadline) {
        console.warn(`[AgentLoop] 45s deadline reached at iter=${iteration}. Returning graceful degradation.`);
        return {
          content: "⚠️ **Analysis time budget exceeded.** The intelligence engine ran out of processing time for this open-ended query. For a fast, focused brief, click a specific event on the 3D globe and ask your question there.",
          webUrls: collectedWebUrls
        };
      }
      const genId = crypto.randomUUID();
      if (traceId && iteration === 0) {
        await lfIngest([lfGenerationStart(genId, traceId, "callAiChat", modelName, messages)]);
      }

      try {
        const body: any = {
          model: modelName,
          messages,
          temperature: 0.3,
          max_tokens: 32000,
        };
        if (tools.length > 0) {
          body.tools = tools;
          body.tool_choice = "auto";
        }

        const res = await fetch(`${FIREWORKS_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error(`AI Platform Chat API Error: ${res.status}: ${await res.text()}`);

        const data = await res.json();
        const choice = data.choices?.[0];
        const assistantMessage = choice?.message;

        // ── Case A: Normal text response — done ─────────────────────────────
        if (!assistantMessage?.tool_calls || assistantMessage.tool_calls.length === 0) {
          const content = assistantMessage?.content ?? "No response generated.";
          if (traceId) {
            await lfIngest([lfGenerationEnd(genId, content, {
              promptTokens: data.usage?.prompt_tokens || 0,
              completionTokens: data.usage?.completion_tokens || 0
            })]);
          }
          return { content, webUrls: collectedWebUrls };
        }

        // ── Case B: Model called a tool ──────────────────────────────────────
        const toolCall = assistantMessage.tool_calls[0];
        console.log(`[AgentLoop] iter=${iteration} tool=${toolCall.function.name}`, toolCall.function.arguments);

        // Add the assistant's tool_call turn to message history
        messages.push({ role: "assistant", content: null, tool_calls: assistantMessage.tool_calls });

        if (toolCall.function.name === "search_web") {
          const args = JSON.parse(toolCall.function.arguments ?? "{}");
          const { text: searchText, urls } = await executeWebSearch(
            args.query ?? "",
            webSearchCtx.supabase,
            webSearchCtx.userId,
            webSearchCtx.organizationId,
            webSearchCtx.sessionId
          );
          collectedWebUrls.push(...urls);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `LIVE WEB SEARCH RESULTS for "${args.query}":\n\n${searchText}\n\nSynthesize these results with the RAG context. Always cite source URLs in your final response.`
          });
          // Loop — model will now synthesize with web results
          continue;
        }

        // Unknown tool — break safely
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: "Tool not available." });
        break;

      } catch (err: any) {
        console.error(`[AgentLoop] Model ${modelName} iter=${iteration} failed:`, err);
        lastError = err;
        break;
      }
    }

    // If we got here without returning, something went wrong — try next model
    if (lastError) continue;
    return { content: "Analysis timed out after tool calls.", webUrls: collectedWebUrls };
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

    const nowTs = new Date();
    console.log(`[Hybrid Search] Processing query: "${query}" for user ${userId} at ${nowTs.toISOString()}`);

    let relevantEvents = bulk_events || [];
    let usedTemporalBypass = false;

    // Perform background hybrid search for historical context.
    if (!bulk_events || bulk_events.length === 0) {

      // ── Step 1a: Temporal Bypass ─────────────────────────────────────────
      // If the query is time-relative ("today", "latest", "last 6 hours", etc.)
      // skip semantic search entirely and fetch the top 25 most severe events
      // from that time window directly — guaranteed real, current data.
      const temporalHours = detectTemporalHours(query);

      if (temporalHours !== null && !event_context) {
        const since = new Date(Date.now() - temporalHours * 3600 * 1000).toISOString();
        console.log(`[Temporal] Detected ${temporalHours}h window. Fetching top 25 most severe events since ${since}`);

        const { data: temporalEvents, error: temporalErr } = await supabase
          .from("sentinel_events")
          .select("id, headline, event_type, severity, occurred_at, country_code, source_url, ai_analysis, full_text, lat, lng")
          .gte("occurred_at", since)
          .not("severity", "is", null)
          .order("severity", { ascending: false })   // Primary sort: highest severity first
          .order("occurred_at", { ascending: false }) // Secondary sort: most recent within same severity
          .limit(25);                                 // Cap at 25 — keeps context window lean

        if (temporalErr) {
          console.error("[Temporal] Fetch error, falling back to semantic search:", temporalErr);
        } else if (temporalEvents && temporalEvents.length > 0) {
          relevantEvents = temporalEvents;
          usedTemporalBypass = true;
          console.log(`[Temporal] ✓ ${temporalEvents.length} events returned (window: last ${temporalHours}h, top by severity)`);
        } else {
          // DB has no events for this time window — inform the user specifically
          console.log(`[Temporal] No events found for last ${temporalHours}h. Returning targeted empty response.`);
          await lfIngest([lfTraceUpdate(traceId, `[TEMPORAL_EMPTY] No events in last ${temporalHours}h`)]);
          return new Response(
            JSON.stringify({
              ok: true,
              answer: `📭 **No events found in the last ${temporalHours < 24 ? temporalHours + ' hours' : temporalHours / 24 === 1 ? '24 hours' : (temporalHours / 24) + ' days'}.**\n\nSentinel's live event database has no indexed incidents for this time window as of **${nowTs.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${nowTs.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} GMT**.\n\n**This may mean:**\n- ⚙️ The live data pollers (GDELT, ACLED, FIRMS) are not actively running — check the **Workflows** tab\n- 🌍 No qualifying events were detected globally in this period (unlikely for a 24h window)\n- 🕐 Events are still being processed and ingested`,
              sources: [],
              event_count: 0,
              grounded: false,
              temporal_hours: temporalHours,
            }),
            { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
      }

      // ── Step 1b: Semantic Search (non-temporal queries) ──────────────────
      if (!usedTemporalBypass) {
        const searchContext = event_context?.headline ? `${query} (Context: ${event_context.headline})` : query;
        const [filters, queryEmbedding] = await Promise.all([
          extractFilters(query, traceId),
          embedQuery(searchContext)
        ]);

        const finalCountry = filters.country_code === 'GLOBAL'
          ? null
          : (filters.country_code || country_code || event_context?.country_code);

        console.log(`[Hybrid Search] Filters:`, { ...filters, country_code: finalCountry });

        // To prevent 'statement timeout' in Postgres full-text search, we shouldn't
        // pass massive prompts into websearch_to_tsquery.
        const optimizedQueryText = event_context?.headline
          ? event_context.headline
          : (query.length > 60 ? query.substring(0, 60) : query);

        const { data: dbEvents, error: dbErr } = await supabase.rpc('hybrid_search_events', {
          p_query_text: optimizedQueryText,
          p_query_embedding: queryEmbedding,
          p_match_count: 50,
          p_country_code: finalCountry || null,
          p_start_date: filters.start_date || null,
          p_end_date: filters.end_date || null,
          p_min_severity: filters.min_severity || null,
          p_organization_id: "00000000-0000-0000-0000-000000000001"
        });

        if (dbErr) throw dbErr;
        relevantEvents = dbEvents || [];

        // ── RAG Guard: block LLM if semantic search also returned nothing ──
        if (relevantEvents.length === 0 && !event_context) {
          await lfIngest([lfTraceUpdate(traceId, "[RAG_GUARD] No semantic context — blocked")]);
          return new Response(
            JSON.stringify({
              ok: true,
              answer: `⚠️ **Sentinel requires grounded context to respond.**\n\nNo indexed events were found matching your query for **${nowTs.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}**. To prevent hallucination, Sentinel will not generate an ungrounded intelligence brief.\n\n**Try one of these:**\n- 🌍 Click a specific event on the 3D globe to analyse it directly\n- 🔍 Use a more specific country or event type (e.g. "security events in Ukraine")\n- ⚙️ Verify that live data pollers are active in the **Workflows** tab`,
              sources: [],
              event_count: 0,
              grounded: false
            }),
            { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
      }
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

    const systemPrompt = `[TEMPORAL LOCK — IMMUTABLE CONSTRAINT]
CURRENT DATE AND TIME (UTC): ${nowTs.toISOString()}
CURRENT DATE (HUMAN-READABLE): ${nowTs.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
You MUST treat this as the definitive present moment. You MUST NOT reference any date from your training data as "today", "recent", or "current". All temporal framing in your response must be anchored to the date above.

You are Sentinel, an elite geopolitical intelligence analyst serving institutional clients (hedge funds, multinationals). You have access to real-time event data from GDELT, ACLED, NASA FIRMS, and AI-enriched supply chain intelligence provided in the context below.

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

GROUNDING RULES:
1. If a PRIMARY FOCUSED EVENT is provided, it is your ABSOLUTE source of truth. Frame entirely around it.
2. HISTORICAL / BACKGROUND EVENTS are past events for context only — do not confuse with the Primary Focused Event.
3. You have ONE tool available: search_web(query, reason). Use it SPARINGLY — only for a specific fact missing from the provided context (e.g. a breaking event from the last 2 hours, a live commodity price). Do NOT use it for general knowledge or for content already in the context above.
4. When you use search_web, formulate a precise, factual query. After receiving results, always cite the source URL in your response.
5. If no tool call is needed and context is insufficient, say so explicitly — do not fill gaps with training memory.

${focusedEventStr}
${deterministicGraphStr}

HISTORICAL / BACKGROUND EVENTS FROM DATABASE (Markdown):
${markdownPayload}

USER QUERY: ${query}

If the context is empty, state that no relevant events were found in Sentinel's database for this period.`;

    // Build message history for multi-turn conversation context
    const historyMessages = (conversation_history || []).slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // ── Determine if web search is permitted for this org ────────────────────
    // BYOD orgs must explicitly opt-in; platform users get it by default.
    const hasByodData = !!(bulk_events && bulk_events.length > 0);
    const organizationId = "00000000-0000-0000-0000-000000000001"; // TODO: extract from JWT for multi-org
    const webSearchAllowed = await isWebSearchEnabled(supabase, organizationId, hasByodData);

    // ── Freeform query guard ─────────────────────────────────────────────────
    // If the user has NOT clicked an event and has NOT lassoed a bulk selection,
    // disable the search_web tool entirely. This makes freeform queries a single
    // fast LLM call (RAG context → LLM → response) with no agentic tool loop,
    // eliminating the primary source of "Analysis timed out" errors.
    // Tools are re-enabled automatically when a focused event context is present.
    const hasFocusedContext = !!(event_context || (bulk_events && bulk_events.length > 0));
    const activeTools = (webSearchAllowed && hasFocusedContext) ? SEARCH_TOOLS : [];

    console.log(`[Chat] webSearch=${webSearchAllowed ? 'enabled' : 'disabled'}, focusedContext=${hasFocusedContext}, tools=${activeTools.length}`);

    const { content: rawAnswer, webUrls } = await callAiChat(
      systemPrompt,
      historyMessages,
      activeTools,
      { supabase, userId, organizationId, sessionId: traceId },
      traceId
    );
    
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

    // Extract exact source URLs from RAG events
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

    // Merge any live web URLs the model cited during tool calling
    const webSources = (webUrls || []).slice(0, 3).map((url: string) => {
      try {
        return { label: `[WEB] ${new URL(url).hostname}`, url };
      } catch { return { label: "[WEB] Live Source", url }; }
    });
    const allSources = [...sources, ...webSources];

    await lfIngest([lfTraceUpdate(traceId, answer)]);

    return new Response(
      JSON.stringify({
        ok: true,
        answer,
        sources: allSources,
        event_count: relevantEvents?.length || 0,
        grounded: true,
        temporal_bypass: usedTemporalBypass,
      }),
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

