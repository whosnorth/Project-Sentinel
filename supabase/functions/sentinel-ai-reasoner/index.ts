// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Langfuse } from "npm:langfuse";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREWORKS_API_KEY = Deno.env.get("FIREWORKS_API_KEY")!;

const langfuse = new Langfuse({
  secretKey: Deno.env.get("LANGFUSE_SECRET_KEY") || "",
  publicKey: Deno.env.get("LANGFUSE_PUBLIC_KEY") || "",
  baseUrl: Deno.env.get("LANGFUSE_HOST") || "http://localhost:3000"
});

const FIREWORKS_BASE = "https://api.fireworks.ai/inference/v1";
const FALLBACK_MODELS = [
  "accounts/fireworks/models/deepseek-v4-pro",
  "accounts/fireworks/models/deepseek-v4-pro",
  "openai/gpt-4o-mini"
];

async function callAiPlatformBatch(prompt: string, traceId?: string): Promise<string> {
  let lastError = "";

  for (const model of FALLBACK_MODELS) {
    const generation = langfuse.generation({
      name: "callAiPlatformBatch",
      traceId,
      model,
      prompt,
    });

    try {
      const res = await fetch(
        `${FIREWORKS_BASE}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://complimetrics.ai",
            "X-Title": "Complimetrics Sentinel Reasoner"
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2, // Low temp for extraction tasks
            max_tokens: 2000
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        let content = data.choices?.[0]?.message?.content ?? "[]";
        
        generation.end({
          completion: content,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
          }
        });

        // Robust JSON extraction
        const jsonStart = content.indexOf('[');
        const jsonEnd = content.lastIndexOf(']');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          content = content.substring(jsonStart, jsonEnd + 1);
        }
        return content;
      }

      lastError = `${res.status} ` + await res.text();
      generation.end({ level: "WARNING", statusMessage: lastError });
      console.warn(`Model ${model} failed: ${lastError}`);
    } catch (err: any) {
      generation.end({ level: "WARNING", statusMessage: String(err) });
      lastError = String(err);
      console.warn(`Model ${model} failed: ${lastError}`);
    }
  }

  throw new Error(`AI Platform all fallback models failed. Last error: ${lastError}`);
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
      name: "sentinel-ai-reasoner",
      input: { events_count: events.length },
    });

    // ── Step 1: Batch Prompt Generation ──────────────────────────────────────
    function batchToMarkdown(events: any[]): string {
      return events.map(e => `
### Event ID: ${e.url || e.id || "unknown"}
* **Location:** ${e.cc || "Global"}
* **Raw Text:** ${e.headline}
---`).join("\n");
    }

    const markdownContext = batchToMarkdown(events);

    const extractionPrompt = `
You are a geopolitical intelligence analyst. Analyze this batch of high-severity news events.

Return a JSON array of objects.
For EACH event in the markdown context below, you MUST return an object that includes the EXACT "id" provided in the "Event ID" field.
Extract the following fields for each event:
- "id": The EXACT string from the "Event ID:" field.
- "entity": The primary actor, organisation, or location.
- "description": One concise sentence summarizing the core event.
- "supply_chain_impact": Brief description of immediate supply chain or trade impact, or null.
- "commodities": Array of affected commodities (e.g. ["Oil", "Wheat"]), or empty array.
- "routes": Array of affected shipping or trade routes, or empty array.

Here are the events:
${markdownContext}
`;

    let aiResults: any[] = [];
    try {
      const extractedRaw = await callAiPlatformBatch(extractionPrompt, trace.id);
      console.log("Raw LLM Output: ", extractedRaw);
      aiResults = JSON.parse(extractedRaw);
    } catch (parseErr: any) {
      trace.update({ level: "ERROR", statusMessage: String(parseErr) });
      await langfuse.flushAsync();
      console.error("AI batch extraction failed:", parseErr);
      return new Response(JSON.stringify({ ok: false, error: "AI Parsing Failed", details: String(parseErr) }), { status: 500 });
    }

    // Map AI results by ID for 100% stable matching
    const analysisMap = new Map<string, any>();
    if (Array.isArray(aiResults)) {
      for (const res of aiResults) {
        if (res.id) analysisMap.set(res.id, res);
      }
    } else {
      console.warn("AI did not return an array.");
    }

    // Vector search has been disabled in the query function, so we no longer generate or store embeddings here to save API limits.

    // ── Step 3: Batch Database Update (parallel, not sequential) ───────────────
    const affectedCountries = new Set<string>();

    const updatePayloads = events.map((event) => {
      if (event.cc) affectedCountries.add(event.cc);
      
      const eventId = event.url || event.id;
      const analysis = analysisMap.get(eventId) || {};

      return {
        source_url: event.url,
        ai_analysis: analysis,
        headline: analysis.description
          ? `${analysis.entity}: ${analysis.description}`
          : event.headline,
      };
    });

    // Single parallel batch — each update is independent so Promise.all is safe
    await Promise.all(
      updatePayloads.map((payload) =>
        supabase.from("sentinel_events").update({
          ai_analysis: payload.ai_analysis,
          headline: payload.headline,
        }).eq("source_url", payload.source_url)
      )
    );

    // ── Step 4: Trigger GPR calculator for all affected countries (parallel) ───────
    if (affectedCountries.size > 0) {
      await Promise.all(
        [...affectedCountries].map((countryCode) =>
          supabase.functions.invoke("sentinel-gpr-calculator", {
            body: { country_code: countryCode },
          })
        )
      );
    }

    trace.update({ output: { processed: events.length } });
    await langfuse.flushAsync();

    return new Response(JSON.stringify({ ok: true, processed: events.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("AI reasoner error:", err);
    await langfuse.flushAsync();
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

