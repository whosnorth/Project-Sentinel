import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Calculator, Save, CheckCircle2, Star, StarOff, RefreshCw, Info,
  Plus, Trash2, ChevronDown, ChevronUp, BarChart3, Sliders
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type FrameworkKey = "fsi" | "wgi" | "acled" | "icrg" | "gpi";

type FormulaConfig = {
  version: "1.0";
  decay_lambda: number;
  frameworks: Record<FrameworkKey, { weight: number; label: string }>;
  bucket_event_map: Record<string, string[]>;
};

type SavedFormula = {
  id: string;
  name: string;
  description: string | null;
  formula_config: FormulaConfig;
  is_active: boolean;
  created_at: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const FRAMEWORK_META: Record<FrameworkKey, { label: string; description: string; color: string }> = {
  fsi:   { label: "State Fragility (FSI)", description: "Fund for Peace — measures state cohesion, economic stress, political legitimacy.", color: "hsl(0,70%,55%)" },
  wgi:   { label: "Governance (WGI)", description: "World Bank — measures government effectiveness, accountability, rule of law.", color: "hsl(40,80%,55%)" },
  acled: { label: "Armed Conflict (ACLED)", description: "Real event data — measures active violence, deadliness, and geographic spread.", color: "hsl(10,75%,55%)" },
  icrg:  { label: "Country Risk (ICRG)", description: "PRS Group — measures political, financial, and economic risk.", color: "hsl(200,70%,55%)" },
  gpi:   { label: "Peace Index (GPI)", description: "IEP — measures societal safety, militarisation, and conflict.", color: "hsl(270,60%,60%)" },
};

const DEFAULT_EVENT_BUCKET_MAP: Record<string, string[]> = {
  security:        ["fsi_cohesion", "gpi_conflict", "acled_deadliness", "wgi_stability"],
  conflict:        ["fsi_cohesion", "gpi_conflict", "acled_deadliness", "wgi_stability"],
  terrorism:       ["fsi_cohesion", "gpi_conflict", "acled_deadliness", "wgi_stability"],
  violence:        ["fsi_cohesion", "gpi_societal", "acled_deadliness"],
  infrastructure:  ["fsi_services", "wgi_effectiveness", "icrg_economic"],
  environmental:   ["fsi_demographic", "gpi_societal"],
  economy:         ["fsi_economic", "icrg_economic", "icrg_financial"],
  trade:           ["fsi_economic", "icrg_financial"],
  sanctions:       ["fsi_economic", "icrg_financial", "wgi_stability"],
  government:      ["fsi_legitimacy", "wgi_effectiveness", "icrg_political"],
  protest:         ["fsi_legitimacy", "wgi_accountability", "gpi_societal"],
  coup:            ["fsi_cohesion", "fsi_legitimacy", "wgi_stability", "icrg_political"],
  military:        ["gpi_militarisation", "acled_deadliness", "fsi_external"],
  humanitarian:    ["fsi_demographic", "fsi_refugees"],
};

const PLATFORM_DEFAULT_FORMULA: FormulaConfig = {
  version: "1.0",
  decay_lambda: 0.05,
  frameworks: {
    fsi:   { weight: 0.25, label: "State Fragility" },
    wgi:   { weight: 0.25, label: "Governance" },
    acled: { weight: 0.20, label: "Armed Conflict" },
    icrg:  { weight: 0.20, label: "Country Risk" },
    gpi:   { weight: 0.10, label: "Peace Index" },
  },
  bucket_event_map: DEFAULT_EVENT_BUCKET_MAP,
};

const PRESET_PROFILES: Record<string, { label: string; formula: FormulaConfig }> = {
  platform: {
    label: "Platform Default",
    formula: PLATFORM_DEFAULT_FORMULA,
  },
  maritime: {
    label: "Maritime / Shipping",
    formula: {
      ...PLATFORM_DEFAULT_FORMULA,
      frameworks: {
        fsi:   { weight: 0.15, label: "State Fragility" },
        wgi:   { weight: 0.15, label: "Governance" },
        acled: { weight: 0.45, label: "Armed Conflict" },
        icrg:  { weight: 0.15, label: "Country Risk" },
        gpi:   { weight: 0.10, label: "Peace Index" },
      },
    },
  },
  sovereign: {
    label: "Sovereign Default / Hedge Fund",
    formula: {
      ...PLATFORM_DEFAULT_FORMULA,
      frameworks: {
        fsi:   { weight: 0.20, label: "State Fragility" },
        wgi:   { weight: 0.20, label: "Governance" },
        acled: { weight: 0.10, label: "Armed Conflict" },
        icrg:  { weight: 0.40, label: "Country Risk" },
        gpi:   { weight: 0.10, label: "Peace Index" },
      },
    },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function getWeightTotal(formula: FormulaConfig): number {
  return Object.values(formula.frameworks).reduce((sum, f) => sum + f.weight, 0);
}

function decayDaysTo50Pct(lambda: number): number {
  // e^(-lambda * t) = 0.5  =>  t = ln(2) / lambda
  return Math.round(Math.log(2) / lambda);
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function FormulaBuilder() {
  const [formula, setFormula] = useState<FormulaConfig>(PLATFORM_DEFAULT_FORMULA);
  const [formulaName, setFormulaName] = useState("My Custom Formula");
  const [formulaDesc, setFormulaDesc] = useState("");
  const [savedFormulas, setSavedFormulas] = useState<SavedFormula[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showBuckets, setShowBuckets] = useState(false);
  const [activePreset, setActivePreset] = useState("platform");

  const weightTotal = getWeightTotal(formula);
  const isValid = Math.abs(weightTotal - 1.0) < 0.011;

  // Load saved formulas on mount
  useEffect(() => {
    supabase
      .from("organization_scoring_formulas")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSavedFormulas(data); });
  }, []);

  // ── Weight slider handler — auto-balance remaining weights ─────────────────
  const handleWeightChange = useCallback((changedKey: FrameworkKey, newWeight: number) => {
    const clamped = Math.max(0, Math.min(1, newWeight));
    const otherKeys = (Object.keys(formula.frameworks) as FrameworkKey[]).filter(k => k !== changedKey);
    const remaining = 1.0 - clamped;
    const currentOtherTotal = otherKeys.reduce((s, k) => s + formula.frameworks[k].weight, 0);

    const newFrameworks = { ...formula.frameworks };
    newFrameworks[changedKey] = { ...newFrameworks[changedKey], weight: clamped };

    if (currentOtherTotal > 0) {
      // Proportionally re-distribute remaining weight
      otherKeys.forEach(k => {
        const proportion = formula.frameworks[k].weight / currentOtherTotal;
        newFrameworks[k] = { ...newFrameworks[k], weight: Math.round(remaining * proportion * 100) / 100 };
      });
    } else {
      // Distribute evenly
      const share = Math.round((remaining / otherKeys.length) * 100) / 100;
      otherKeys.forEach(k => { newFrameworks[k] = { ...newFrameworks[k], weight: share }; });
    }

    setFormula(f => ({ ...f, frameworks: newFrameworks }));
    setSaved(false);
    setActivePreset("custom");
  }, [formula.frameworks]);

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        name: formulaName,
        description: formulaDesc || null,
        formula_type: "gpr",
        formula_config: formula,
        is_active: false,
      };
      const { error } = await supabase.from("organization_scoring_formulas").insert(payload);
      if (error) throw error;
      setSaved(true);
      const { data } = await supabase.from("organization_scoring_formulas").select("*").order("created_at", { ascending: false });
      if (data) setSavedFormulas(data);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    // Trigger the DB trigger which auto-deactivates others
    await supabase.from("organization_scoring_formulas").update({ is_active: true }).eq("id", id);
    await supabase.from("organization_scoring_formulas").update({ is_active: false }).neq("id", id);
    const { data } = await supabase.from("organization_scoring_formulas").select("*").order("created_at", { ascending: false });
    if (data) setSavedFormulas(data);
  }

  async function deleteFormula(id: string) {
    await supabase.from("organization_scoring_formulas").delete().eq("id", id);
    setSavedFormulas(f => f.filter(x => x.id !== id));
  }

  function loadFormula(f: SavedFormula) {
    setFormula(f.formula_config);
    setFormulaName(f.name);
    setFormulaDesc(f.description ?? "");
    setActivePreset("custom");
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-gray-100 font-mono">
      {/* Header */}
      <div className="border-b border-yellow-500/20 bg-black/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-yellow-400" />
          <div>
            <h1 className="text-yellow-400 font-bold tracking-widest text-sm uppercase">
              Formula Builder
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Customize the GPR/CSI scoring formula for your organization's risk priorities.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 h-[calc(100vh-73px)]">
        {/* ── Left: Slider editor ──────────────────────────────────────────── */}
        <div className="col-span-2 overflow-y-auto p-8 space-y-8 border-r border-yellow-500/10">
          {/* Formula name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Formula Name</label>
              <input
                value={formulaName}
                onChange={e => setFormulaName(e.target.value)}
                className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Description</label>
              <input
                value={formulaDesc}
                onChange={e => setFormulaDesc(e.target.value)}
                placeholder="e.g. Maritime shipping risk focus"
                className="w-full bg-black/60 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:border-yellow-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Preset quick-apply */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3 h-3" /> Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESET_PROFILES).map(([key, { label, formula: pf }]) => (
                <button
                  key={key}
                  onClick={() => { setFormula(pf); setActivePreset(key); setSaved(false); }}
                  className={`px-3 py-1.5 rounded text-xs border transition-all ${
                    activePreset === key
                      ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-400"
                      : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Framework weight sliders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-3 h-3" /> Framework Weights
              </label>
              <span className={`text-xs px-2 py-0.5 rounded border ${
                isValid
                  ? "border-green-500/40 text-green-400 bg-green-500/5"
                  : "border-red-500/40 text-red-400 bg-red-500/5"
              }`}>
                Total: {(weightTotal * 100).toFixed(0)}% {isValid ? "✓" : "(must = 100%)"}
              </span>
            </div>

            {(Object.keys(FRAMEWORK_META) as FrameworkKey[]).map(key => {
              const meta = FRAMEWORK_META[key];
              const weight = formula.frameworks[key]?.weight ?? 0;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-200">{meta.label}</span>
                      <p className="text-xs text-gray-600 mt-0.5">{meta.description}</p>
                    </div>
                    <span className="text-yellow-400 font-bold text-sm w-12 text-right">
                      {(weight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="range" min="0" max="1" step="0.01"
                        value={weight}
                        onChange={e => handleWeightChange(key, parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${meta.color} 0%, ${meta.color} ${weight * 100}%, #1f2937 ${weight * 100}%, #1f2937 100%)`
                        }}
                      />
                    </div>
                    {/* Mini bar */}
                    <div className="w-12 h-4 bg-gray-800 rounded overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${weight * 100}%`, backgroundColor: meta.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Temporal decay slider */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider">Event Memory (Temporal Decay)</label>
                <p className="text-xs text-gray-600 mt-0.5">
                  How quickly old events lose influence. Lower λ = longer memory.
                </p>
              </div>
              <span className="text-yellow-400 font-bold text-sm">
                ~{decayDaysTo50Pct(formula.decay_lambda)} days to 50% decay
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-600">Long memory</span>
              <input
                type="range" min="0.01" max="0.20" step="0.01"
                value={formula.decay_lambda}
                onChange={e => { setFormula(f => ({ ...f, decay_lambda: parseFloat(e.target.value) })); setSaved(false); }}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-yellow-400"
              />
              <span className="text-xs text-gray-600">Short memory</span>
            </div>
            <div className="flex justify-between text-xs text-gray-700">
              <span>λ=0.01 (~69d)</span>
              <span>λ=0.05 (~14d) — Platform Default</span>
              <span>λ=0.20 (~3d)</span>
            </div>
          </div>

          {/* Event-bucket mapping (advanced, collapsible) */}
          <div className="border-t border-gray-800 pt-4">
            <button
              onClick={() => setShowBuckets(!showBuckets)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showBuckets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Advanced: Event → Framework Bucket Mappings
              <span className="text-gray-700">({Object.keys(formula.bucket_event_map).length} event types configured)</span>
            </button>
            {showBuckets && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-gray-600">
                  Define which event types contribute to which framework sub-indicators. Changes here override the platform defaults for your organization.
                </p>
                {Object.entries(formula.bucket_event_map).map(([eventType, buckets]) => (
                  <div key={eventType} className="flex items-start gap-3 bg-black/30 rounded px-3 py-2">
                    <span className="text-yellow-400/70 text-xs font-bold w-24 shrink-0 mt-0.5">{eventType}</span>
                    <div className="flex flex-wrap gap-1">
                      {buckets.map(b => (
                        <span key={b} className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded">{b}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
            <button
              onClick={handleSave}
              disabled={saving || !isValid}
              className="flex items-center gap-2 px-5 py-2 rounded bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
            >
              {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Formula"}
            </button>
            <button
              onClick={() => { setFormula(PLATFORM_DEFAULT_FORMULA); setActivePreset("platform"); setSaved(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded border border-gray-700 text-gray-400 hover:text-gray-200 text-xs transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Restore Defaults
            </button>
          </div>
        </div>

        {/* ── Right: Saved formulas ─────────────────────────────────────────── */}
        <div className="overflow-y-auto p-6 space-y-4">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider">Saved Formulas</h2>
          {savedFormulas.length === 0 && (
            <p className="text-xs text-gray-700 mt-4">No formulas saved yet. Configure and save one on the left.</p>
          )}
          {savedFormulas.map(f => (
            <div
              key={f.id}
              className={`rounded border p-4 space-y-3 cursor-pointer transition-all hover:border-yellow-500/30 ${
                f.is_active
                  ? "border-yellow-500/40 bg-yellow-500/5"
                  : "border-gray-800 bg-black/20"
              }`}
              onClick={() => loadFormula(f)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-200 font-bold">{f.name}</p>
                  {f.description && <p className="text-xs text-gray-600 mt-0.5">{f.description}</p>}
                </div>
                {f.is_active && <span className="text-yellow-400 text-xs border border-yellow-500/40 px-2 py-0.5 rounded">ACTIVE</span>}
              </div>

              {/* Mini weight bar chart */}
              <div className="flex h-3 rounded overflow-hidden gap-0.5">
                {(Object.keys(FRAMEWORK_META) as FrameworkKey[]).map(k => (
                  <div
                    key={k}
                    title={`${FRAMEWORK_META[k].label}: ${((f.formula_config.frameworks[k]?.weight ?? 0) * 100).toFixed(0)}%`}
                    style={{
                      width: `${(f.formula_config.frameworks[k]?.weight ?? 0) * 100}%`,
                      backgroundColor: FRAMEWORK_META[k].color
                    }}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={e => { e.stopPropagation(); setDefault(f.id); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-yellow-400 transition-colors"
                >
                  {f.is_active ? <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> : <StarOff className="w-3 h-3" />}
                  {f.is_active ? "Default" : "Set Default"}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteFormula(f.id); }}
                  className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors ml-auto"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
