// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Langfuse } from "npm:langfuse";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY")!;

const langfuse = new Langfuse({
  secretKey: Deno.env.get("LANGFUSE_SECRET_KEY") || "",
  publicKey: Deno.env.get("LANGFUSE_PUBLIC_KEY") || "",
  baseUrl: Deno.env.get("LANGFUSE_HOST") || "https://cloud.langfuse.com"
});

const FIREWORKS_BASE = "https://api.fireworks.ai/inference/v1";

// Environmental Model Configuration
const MACRO_MODEL = Deno.env.get("MACRO_MODEL") || "accounts/fireworks/models/deepseek-v4-pro";
const FORMATTER_MODEL = Deno.env.get("FORMATTER_MODEL") || "accounts/fireworks/models/deepseek-v4-flash";
const VISION_MODEL = Deno.env.get("VISION_MODEL") || "accounts/fireworks/models/deepseek-v4-pro";
const CODER_MODEL = Deno.env.get("CODER_MODEL") || "accounts/fireworks/models/deepseek-v4-flash";

// Helper to interact with Fireworks Chat Completion
async function callModel(model: string, messages: any[], temperature = 0.5, maxTokens = 2000, responseFormat = null) {
  const body: any = {
    model: model,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const res = await fetch(`${FIREWORKS_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://complimetrics.ai",
      "X-Title": "Complimetrics Sentinel Macro-Orchestrator"
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error from ${model}: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// 1. Multimodal Watchdog
async function processVision(imageUrls: string[]): Promise<string> {
  if (!imageUrls || imageUrls.length === 0) return "";
  
  const content = [
    { type: "text", text: "Describe the geopolitical, supply chain, or operational anomalies visible in these images." }
  ];

  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }

  return await callModel(VISION_MODEL, [{ role: "user", content }], 0.2, 1000);
}

// 2. Macro-Orchestrator
async function processReasoning(eventContext: string, visionContext: string): Promise<string> {
  const prompt = `You are the Sentinel Macro-Orchestrator, a military-grade geopolitical and supply chain intelligence analyzer.
Analyze the following event context and any associated visual intelligence.

Focus purely on reasoning. What are the secondary and tertiary effects? Who are the primary actors? Which shipping routes and commodities are directly threatened?

Event Context:
${eventContext}

Visual Context (if any):
${visionContext}

Think deeply. Do not format as JSON. Write a structured analytical report.
`;

  return await callModel(MACRO_MODEL, [{ role: "user", content: prompt }], 0.7, 3000);
}

// 3. Execution Specialist (Sandboxed Fetch)
// For V1, if the orchestrator specifies URLs to check, we fetch them directly.
async function processExecution(analysisText: string): Promise<string> {
  // Simplistic routing logic: If the reasoning says [FETCH: url], we fetch it.
  const fetchMatches = analysisText.match(/\[FETCH:\s*(https?:\/\/[^\]]+)\]/g);
  if (!fetchMatches) return "";

  let extraData = "\n\n--- External Data Gathered ---\n";
  for (const match of fetchMatches) {
    const url = match.match(/\[FETCH:\s*(https?:\/\/[^\]]+)\]/)?.[1];
    if (url) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const text = await res.text();
          extraData += `Data from ${url}:\n${text.substring(0, 1000)}\n\n`;
        }
      } catch (e) {
        extraData += `Failed to fetch ${url}: ${e.message}\n`;
      }
    }
  }
  return extraData;
}

// 4. JSON Latency Assassin
async function processFormatting(rawAnalysis: string, eventId: string, eventOriginal: any): Promise<any> {
  const prompt = `You are the JSON Latency Assassin. Your only job is to format unstructured intelligence into strict JSON for a UI dashboard.

Input Analysis:
${rawAnalysis}

Return a single JSON object with EXACTLY these fields (no markdown blocks, just raw JSON):
- "id": "${eventId}"
- "entity": The primary actor, organisation, or location.
- "description": One concise sentence summarizing the core event.
- "supply_chain_impact": Brief description of immediate supply chain or trade impact, or null.
- "commodities": Array of affected commodities (e.g. ["Oil", "Wheat"]), or empty array.
- "routes": Array of affected shipping or trade routes, or empty array.
`;

  // Provide a system message to enforce JSON formatting
  const messages = [
    { role: "system", content: "You are a pure JSON formatter. You output ONLY valid JSON without any markdown code blocks (e.g., no ```json)." },
    { role: "user", content: prompt }
  ];

  const jsonString = await callModel(FORMATTER_MODEL, messages, 0.1, 1000);
  
  // Robust JSON extraction
  let cleanString = jsonString;
  const jsonStart = cleanString.indexOf('{');
  const jsonEnd = cleanString.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleanString = cleanString.substring(jsonStart, jsonEnd + 1);
  }

  try {
    return JSON.parse(cleanString);
  } catch (e) {
    console.error("JSON formatting failed on string:", cleanString);
    throw new Error("JSON Latency Assassin failed to produce valid JSON");
  }
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { events } = (await req.json()) as { events: any[] };

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const trace = langfuse.trace({
      name: "sentinel-macro-orchestrator",
      input: { events_count: events.length },
    });

    const affectedCountries = new Set<string>();
    const updatePayloads = [];

    // Process events (parallelizing across events to utilize burst concurrency)
    await Promise.all(events.map(async (event) => {
      try {
        if (event.cc) affectedCountries.add(event.cc);
        const eventId = event.url || event.id;
        
        const eventContext = `
Headline: ${event.headline}
Location: ${event.cc || "Global"}
Source: ${event.url || "Unknown"}
        `.trim();

        // 1. Multimodal Watchdog
        let visionContext = "";
        if (event.image_urls && event.image_urls.length > 0) {
          const visionSpan = trace.span({ name: "MultimodalWatchdog" });
          visionContext = await processVision(event.image_urls);
          visionSpan.end({ output: visionContext });
        }

        // 2. Macro-Orchestrator
        const reasonSpan = trace.span({ name: "MacroOrchestrator" });
        let reasoning = await processReasoning(eventContext, visionContext);
        
        // 3. Execution Specialist
        const execSpan = trace.span({ name: "ExecutionSpecialist" });
        const execData = await processExecution(reasoning);
        if (execData) {
          reasoning += execData;
          // Re-evaluate if needed, but for latency we just append context for the formatter
        }
        reasonSpan.end({ output: reasoning });
        execSpan.end({ output: execData || "No execution needed" });

        // 4. JSON Latency Assassin
        const formatSpan = trace.span({ name: "JSONLatencyAssassin" });
        const finalJson = await processFormatting(reasoning, eventId, event);
        formatSpan.end({ output: finalJson });

        updatePayloads.push({
          source_url: event.url,
          ai_analysis: finalJson,
          headline: finalJson.description ? `${finalJson.entity}: ${finalJson.description}` : event.headline,
        });

      } catch (err) {
        console.error(`Failed to process event ${event.id || event.url}:`, err);
      }
    }));

    if (updatePayloads.length > 0) {
      await Promise.all(
        updatePayloads.map((payload) =>
          supabase.from("sentinel_events").update({
            ai_analysis: payload.ai_analysis,
            headline: payload.headline,
          }).eq("source_url", payload.source_url)
        )
      );
    }

    if (affectedCountries.size > 0) {
      await Promise.all(
        [...affectedCountries].map((countryCode) =>
          supabase.functions.invoke("sentinel-gpr-calculator", {
            body: { country_code: countryCode },
          })
        )
      );
    }

    trace.update({ output: { processed: updatePayloads.length } });
    await langfuse.flushAsync();

    return new Response(JSON.stringify({ ok: true, processed: updatePayloads.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Orchestrator error:", err);
    await langfuse.flushAsync();
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
