// _shared/model-router.ts
// Universal LLM caller for Sentinel Edge Functions.
// Supports any OpenAI-compatible provider: Fireworks AI, OpenAI, Anthropic (via
// compatibility shim), Azure OpenAI, and self-hosted / air-gapped endpoints.
//
// Usage:
//   import { callLLM, callEmbedding } from "../_shared/model-router.ts";
//
// @ts-nocheck

const PLATFORM_FIREWORKS_KEY = () => Deno.env.get("FIREWORKS_API_KEY")!;

// ── Default platform configs (used when org has no custom config) ─────────────
export const PLATFORM_DEFAULTS = {
  analyst: {
    provider_name: "fireworks",
    model_id: "accounts/fireworks/models/deepseek-v4-pro",
    api_base_url: "https://api.fireworks.ai/inference/v1",
    temperature: 0.3,
    max_tokens: 32000,
    api_key_secret_id: null, // uses FIREWORKS_API_KEY env var
  },
  router: {
    provider_name: "fireworks",
    model_id: "accounts/fireworks/models/deepseek-v4-flash",
    api_base_url: "https://api.fireworks.ai/inference/v1",
    temperature: 0.1,
    max_tokens: 500,
    api_key_secret_id: null,
  },
  embedding: {
    provider_name: "fireworks",
    model_id: "nomic-ai/nomic-embed-text-v1.5",
    api_base_url: "https://api.fireworks.ai/inference/v1",
    embedding_dimension: 768,
    api_key_secret_id: null,
  },
};

// ── Vault secret retrieval ────────────────────────────────────────────────────
async function getVaultSecret(secretId: string, supabase: any): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("vault_decrypted_secret", { secret_id: secretId });
    if (error) {
      console.error("[ModelRouter] Vault retrieval error:", error.message);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.error("[ModelRouter] Vault fetch exception:", e);
    return null;
  }
}

// ── Load org LLM config from DB ───────────────────────────────────────────────
export async function loadOrgLLMConfig(
  supabase: any,
  organizationId: string,
  role: "analyst" | "router" | "embedding"
): Promise<typeof PLATFORM_DEFAULTS["analyst"] | null> {
  if (!organizationId || organizationId === "00000000-0000-0000-0000-000000000001") {
    return null; // Platform test org — always use defaults
  }

  try {
    const { data, error } = await supabase
      .from("organization_llm_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("role", role)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error(`[ModelRouter] Failed to load org config for ${role}:`, error.message);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.error(`[ModelRouter] Exception loading org config:`, e);
    return null;
  }
}

// ── Universal Chat Completion Caller ─────────────────────────────────────────
export async function callLLM({
  supabase,
  organizationId,
  role,
  messages,
  overrideConfig,
}: {
  supabase: any;
  organizationId: string;
  role: "analyst" | "router";
  messages: { role: string; content: string }[];
  overrideConfig?: any;
}): Promise<{ content: string; model: string; usage?: any }> {
  // 1. Resolve config: override > org DB config > platform default
  const orgConfig = overrideConfig ?? await loadOrgLLMConfig(supabase, organizationId, role);
  const config = orgConfig ?? PLATFORM_DEFAULTS[role];

  // 2. Resolve API key
  // If api_key_secret_id is null, this is a no-auth (air-gapped) endpoint
  // OR we fall back to the platform Fireworks key for default config.
  let apiKey: string | null = null;
  if (config.api_key_secret_id) {
    apiKey = await getVaultSecret(config.api_key_secret_id, supabase);
    if (!apiKey) {
      throw new Error(`[ModelRouter] Could not retrieve API key from Vault for config role=${role}`);
    }
  } else if (!orgConfig) {
    // No org config = using platform default Fireworks key
    apiKey = PLATFORM_FIREWORKS_KEY();
  }
  // else: orgConfig exists but api_key_secret_id is null = intentional no-auth mode

  // 3. Build headers
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // 4. Call the OpenAI-compatible endpoint
  const endpoint = `${config.api_base_url}/chat/completions`;
  console.log(`[ModelRouter] Calling ${role} → ${config.provider_name}:${config.model_id} @ ${endpoint}`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model_id,
      messages,
      temperature: config.temperature ?? 0.3,
      max_tokens: config.max_tokens ?? 32000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[ModelRouter] ${config.provider_name} API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    model: config.model_id,
    usage: data.usage,
  };
}

// ── Universal Embedding Caller ────────────────────────────────────────────────
export async function callEmbedding({
  supabase,
  organizationId,
  input,
  overrideConfig,
}: {
  supabase: any;
  organizationId: string;
  input: string;
  overrideConfig?: any;
}): Promise<{ embedding: number[]; dimension: number; model: string }> {
  const orgConfig = overrideConfig ?? await loadOrgLLMConfig(supabase, organizationId, "embedding");
  const config = orgConfig ?? PLATFORM_DEFAULTS.embedding;

  let apiKey: string | null = null;
  if (config.api_key_secret_id) {
    apiKey = await getVaultSecret(config.api_key_secret_id, supabase);
    if (!apiKey) throw new Error(`[ModelRouter] Could not retrieve embedding API key from Vault`);
  } else if (!orgConfig) {
    apiKey = PLATFORM_FIREWORKS_KEY();
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const endpoint = `${config.api_base_url}/embeddings`;
  console.log(`[ModelRouter] Embedding → ${config.provider_name}:${config.model_id} (dim=${config.embedding_dimension ?? 768})`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: config.model_id, input }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[ModelRouter] Embedding API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const embedding = data.data?.[0]?.embedding ?? [];

  // ─ Dimension guard: warn if the returned dimension doesn't match config ──
  const expectedDim = config.embedding_dimension ?? 768;
  if (embedding.length > 0 && embedding.length !== expectedDim) {
    console.warn(
      `[ModelRouter] ⚠️ Embedding dimension mismatch: expected ${expectedDim}, got ${embedding.length}. ` +
      `This org may need a re-embedding migration if they recently changed their embedding model.`
    );
  }

  return {
    embedding,
    dimension: embedding.length,
    model: config.model_id,
  };
}

// ── Connection Test ───────────────────────────────────────────────────────────
// Used by the LLM Settings page to verify a config before saving.
export async function testLLMConnection(config: {
  model_id: string;
  api_base_url: string;
  api_key?: string | null;  // null = no-auth mode
  role: "analyst" | "router" | "embedding";
}): Promise<{ ok: boolean; latency_ms: number; model: string; error?: string }> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.api_key) headers["Authorization"] = `Bearer ${config.api_key}`;

    if (config.role === "embedding") {
      const res = await fetch(`${config.api_base_url}/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: config.model_id, input: "Sentinel connection test." }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const dim = data.data?.[0]?.embedding?.length ?? 0;
      return { ok: true, latency_ms: Date.now() - start, model: config.model_id + ` (dim=${dim})` };
    } else {
      const res = await fetch(`${config.api_base_url}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model_id,
          messages: [{ role: "user", content: "Respond with the single word: ONLINE" }],
          max_tokens: 10,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? "(empty)";
      return { ok: true, latency_ms: Date.now() - start, model: `${config.model_id} replied: "${reply.trim()}"` };
    }
  } catch (e: any) {
    return { ok: false, latency_ms: Date.now() - start, model: config.model_id, error: e.message };
  }
}
