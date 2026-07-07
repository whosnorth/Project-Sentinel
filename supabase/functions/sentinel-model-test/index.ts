// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("FIREWORKS_API_KEY") ?? "";
  const results: any[] = [];

  const modelsToTest = [
    "accounts/fireworks/models/deepseek-v3",
    "accounts/fireworks/models/deepseek-v4-pro",
    "accounts/fireworks/models/llama-v3p3-70b-instruct",
    "accounts/fireworks/models/llama-v3p1-70b-instruct",
    "accounts/fireworks/models/llama-v3p1-405b-instruct",
    "accounts/fireworks/models/mixtral-8x7b-instruct",
    "accounts/fireworks/models/qwen2p5-72b-instruct",
  ];

  for (const model of modelsToTest) {
    try {
      const r = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say: ok" }],
          max_tokens: 5,
        }),
      });
      const body = r.ok ? "OK" : await r.text();
      results.push({ model, status: r.status, ok: r.ok, body: r.ok ? "OK" : body.substring(0, 200) });
    } catch (e) {
      results.push({ model, status: "ERROR", ok: false, body: String(e) });
    }
  }

  return new Response(JSON.stringify({ apiKeySet: !!apiKey, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
