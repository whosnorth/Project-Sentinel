import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Settings2, Cpu, Zap, Globe, Plus, Trash2, TestTube2,
  CheckCircle2, XCircle, Eye, EyeOff, AlertTriangle, Lock, Wifi, WifiOff
} from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const PROVIDER_PRESETS: Record<string, { base_url: string; models: { id: string; label: string }[] }> = {
  fireworks: {
    base_url: "https://api.fireworks.ai/inference/v1",
    models: [
      { id: "accounts/fireworks/models/deepseek-v4-pro", label: "DeepSeek V4 Pro (Analyst)" },
      { id: "accounts/fireworks/models/deepseek-v4-flash", label: "DeepSeek V4 Flash (Router)" },
      { id: "nomic-ai/nomic-embed-text-v1.5", label: "Nomic Embed v1.5 (768-dim)" },
    ],
  },
  openai: {
    base_url: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Router)" },
      { id: "text-embedding-3-small", label: "text-embedding-3-small (1536-dim)" },
      { id: "text-embedding-3-large", label: "text-embedding-3-large (3072-dim)" },
    ],
  },
  anthropic: {
    base_url: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "claude-haiku-3-5", label: "Claude Haiku 3.5 (Router)" },
    ],
  },
  azure: {
    base_url: "https://{resource}.openai.azure.com/openai/deployments/{deployment}/v1",
    models: [{ id: "gpt-4o", label: "GPT-4o (Azure)" }],
  },
  custom: {
    base_url: "http://localhost:11434/v1",
    models: [{ id: "llama3:8b", label: "Llama 3 8B (local)" }],
  },
};

const ROLE_ICONS: Record<string, JSX.Element> = {
  analyst: <Cpu className="w-4 h-4" />,
  router: <Zap className="w-4 h-4" />,
  embedding: <Globe className="w-4 h-4" />,
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  analyst: "Deep analysis & intelligence briefs (powerful, expensive). Used by Intel Chat.",
  router: "High-speed event classification & query routing (fast, cheap). The Traffic Cop.",
  embedding: "Converts text to vectors for RAG search. Dimension must match DB index.",
};

type ConfigRow = {
  id?: string;
  role: "analyst" | "router" | "embedding";
  provider_name: string;
  model_id: string;
  api_base_url: string;
  api_key?: string;       // transient — never stored, only sent to vault
  no_auth: boolean;        // true = air-gapped / private network, no API key needed
  temperature: number;
  max_tokens: number;
  embedding_dimension?: number;
  is_active: boolean;
};

const DEFAULT_CONFIG = (role: "analyst" | "router" | "embedding"): ConfigRow => ({
  role,
  provider_name: "fireworks",
  model_id: PROVIDER_PRESETS.fireworks.models[0].id,
  api_base_url: PROVIDER_PRESETS.fireworks.base_url,
  api_key: "",
  no_auth: false,
  temperature: 0.3,
  max_tokens: 32000,
  embedding_dimension: 768,
  is_active: true,
});

export default function LLMSettings() {
  const [configs, setConfigs] = useState<Record<string, ConfigRow>>({
    analyst: DEFAULT_CONFIG("analyst"),
    router: DEFAULT_CONFIG("router"),
    embedding: DEFAULT_CONFIG("embedding"),
  });
  const [activeRole, setActiveRole] = useState<"analyst" | "router" | "embedding">("analyst");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const cfg = configs[activeRole];

  function updateCfg(patch: Partial<ConfigRow>) {
    setConfigs(prev => ({ ...prev, [activeRole]: { ...prev[activeRole], ...patch } }));
    setTestResult(null);
    setSaved(false);
  }

  function onProviderChange(provider: string) {
    const preset = PROVIDER_PRESETS[provider];
    updateCfg({
      provider_name: provider,
      api_base_url: preset.base_url,
      model_id: preset.models[0]?.id ?? "",
      no_auth: false,
    });
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sentinel-model-test", {
        body: {
          model_id: cfg.model_id,
          api_base_url: cfg.api_base_url,
          api_key: cfg.no_auth ? null : cfg.api_key,
          role: cfg.role,
        },
      });
      if (error) throw error;
      if (data?.ok) {
        setTestResult({ ok: true, message: data.model, latency: data.latency_ms });
      } else {
        setTestResult({ ok: false, message: data?.error ?? "Unknown error" });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // In a production environment, the API key would be sent to a secure
      // vault-wrapping edge function, not stored directly. For now we store
      // the config metadata only and note that key handling needs Vault setup.
      const { error } = await supabase.from("organization_llm_configs").upsert({
        role: cfg.role,
        provider_name: cfg.provider_name,
        model_id: cfg.model_id,
        api_base_url: cfg.api_base_url,
        api_key_secret_id: null, // TODO: wrap via vault edge function
        temperature: cfg.temperature,
        max_tokens: cfg.max_tokens,
        embedding_dimension: cfg.embedding_dimension ?? 768,
        is_active: cfg.is_active,
      }, { onConflict: "organization_id,role", ignoreDuplicates: false });

      if (error) throw error;
      setSaved(true);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-gray-100 font-mono">
      {/* Header */}
      <div className="border-b border-yellow-500/20 bg-black/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <Settings2 className="w-5 h-5 text-yellow-400" />
          <div>
            <h1 className="text-yellow-400 font-bold tracking-widest text-sm uppercase">
              LLM Configuration
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Configure inference providers per role. Supports cloud, self-hosted, and air-gapped deployments.
            </p>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Role selector sidebar */}
        <div className="w-56 border-r border-yellow-500/10 bg-black/20 p-4 flex flex-col gap-2">
          {(["analyst", "router", "embedding"] as const).map(role => (
            <button
              key={role}
              onClick={() => { setActiveRole(role); setTestResult(null); }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded text-xs uppercase tracking-wider text-left transition-all ${
                activeRole === role
                  ? "bg-yellow-500/10 border border-yellow-500/40 text-yellow-400"
                  : "border border-transparent text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/5"
              }`}
            >
              {ROLE_ICONS[role]}
              {role}
            </button>
          ))}
        </div>

        {/* Config panel */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl space-y-6">
            {/* Role description */}
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded px-4 py-3 flex items-start gap-3">
              <div className="text-yellow-400 mt-0.5">{ROLE_ICONS[activeRole]}</div>
              <p className="text-yellow-300/70 text-xs leading-relaxed">{ROLE_DESCRIPTIONS[activeRole]}</p>
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Provider</label>
              <div className="grid grid-cols-5 gap-2">
                {Object.keys(PROVIDER_PRESETS).map(p => (
                  <button
                    key={p}
                    onClick={() => onProviderChange(p)}
                    className={`py-2 px-1 rounded text-xs border capitalize transition-all ${
                      cfg.provider_name === p
                        ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-400"
                        : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Model ID */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Model</label>
              <select
                value={cfg.model_id}
                onChange={e => updateCfg({ model_id: e.target.value })}
                className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none"
              >
                {(PROVIDER_PRESETS[cfg.provider_name]?.models ?? []).map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
                <option value="__custom">Custom model ID...</option>
              </select>
              {cfg.model_id === "__custom" && (
                <input
                  placeholder="e.g. meta-llama/Llama-3-8b-hf"
                  className="w-full mt-1 bg-black/60 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none"
                  onChange={e => updateCfg({ model_id: e.target.value })}
                />
              )}
            </div>

            {/* API Base URL */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wider">API Base URL</label>
              <input
                value={cfg.api_base_url}
                onChange={e => updateCfg({ api_base_url: e.target.value })}
                className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none font-mono"
                placeholder="https://api.example.com/v1"
              />
              <p className="text-gray-600 text-xs">
                Must expose an OpenAI-compatible <code>/chat/completions</code> endpoint.
              </p>
            </div>

            {/* Auth mode */}
            <div className="space-y-3">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Authentication</label>
              <div className="flex gap-3">
                <button
                  onClick={() => updateCfg({ no_auth: false })}
                  className={`flex items-center gap-2 px-4 py-2 rounded text-xs border transition-all ${
                    !cfg.no_auth
                      ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-400"
                      : "border-gray-700 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  <Lock className="w-3 h-3" /> API Key
                </button>
                <button
                  onClick={() => updateCfg({ no_auth: true, api_key: "" })}
                  className={`flex items-center gap-2 px-4 py-2 rounded text-xs border transition-all ${
                    cfg.no_auth
                      ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-400"
                      : "border-gray-700 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  <WifiOff className="w-3 h-3" /> No Auth (Air-Gapped)
                </button>
              </div>

              {cfg.no_auth ? (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded px-3 py-2 flex items-start gap-2">
                  <Wifi className="w-3 h-3 text-blue-400 mt-0.5" />
                  <p className="text-blue-300/70 text-xs">
                    No-auth mode enabled. Sentinel will call your endpoint directly without an Authorization header. Ensure your endpoint is reachable from Supabase Edge Functions.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={cfg.api_key ?? ""}
                    onChange={e => updateCfg({ api_key: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 pr-10 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>

            {/* Advanced params */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Temperature</label>
                <input
                  type="number" step="0.1" min="0" max="2"
                  value={cfg.temperature}
                  onChange={e => updateCfg({ temperature: parseFloat(e.target.value) })}
                  className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Max Tokens</label>
                <input
                  type="number" step="1000"
                  value={cfg.max_tokens}
                  onChange={e => updateCfg({ max_tokens: parseInt(e.target.value) })}
                  className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none"
                />
              </div>
            </div>

            {activeRole === "embedding" && (
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-wider">Vector Dimension</label>
                <input
                  type="number"
                  value={cfg.embedding_dimension ?? 768}
                  onChange={e => updateCfg({ embedding_dimension: parseInt(e.target.value) })}
                  className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none"
                />
                <div className="bg-orange-500/5 border border-orange-500/20 rounded px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-orange-400 mt-0.5" />
                  <p className="text-orange-300/70 text-xs">
                    Changing the embedding model requires a full re-indexing of all {">"}16,000 events. Historical vectors from a different model are incompatible. Contact your Sentinel admin before changing.
                  </p>
                </div>
              </div>
            )}

            {/* Test result */}
            {testResult && (
              <div className={`flex items-start gap-2 px-3 py-2 rounded border text-xs ${
                testResult.ok
                  ? "bg-green-500/5 border-green-500/30 text-green-300"
                  : "bg-red-500/5 border-red-500/30 text-red-300"
              }`}>
                {testResult.ok
                  ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 mt-0.5" />}
                <div>
                  <p className="font-bold">{testResult.ok ? "Connection Successful" : "Connection Failed"}</p>
                  <p className="text-xs opacity-70 mt-0.5">{testResult.message}</p>
                  {testResult.latency !== undefined && (
                    <p className="text-xs opacity-50 mt-0.5">Latency: {testResult.latency}ms</p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-yellow-500/50 hover:text-yellow-400 text-xs transition-all disabled:opacity-40"
              >
                <TestTube2 className="w-3.5 h-3.5" />
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
              >
                {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                {saving ? "Saving..." : saved ? "Saved!" : "Save Config"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
