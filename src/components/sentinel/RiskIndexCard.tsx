import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { CountryWeight } from "./LocationSelector";

type Props = {
  score: number;
  prevScore?: number;
  // v1 legacy
  securityScore?: number;
  economyScore?: number;
  socialScore?: number;
  // v2 framework scores
  fsiScore?: number;
  wgiScore?: number;
  acledScore?: number;
  icrgScore?: number;
  gpiScore?: number;
  // optional indicator breakdown
  breakdown?: Record<string, number>;
  country?: string;
  window?: string;
  weightBreakdown?: (CountryWeight & { score: number })[];
  methodVersion?: string;
};

const FRAMEWORKS = [
  {
    key: "fsi",
    abbr: "FSI",
    label: "Fragile States Index",
    source: "Fund for Peace",
    color: "text-red-400",
    bg: "bg-red-900/30",
    border: "border-red-800/40",
    indicators: [
      { key: "fsi_cohesion",  label: "Security Cohesion" },
      { key: "fsi_economic",  label: "Economic Resilience" },
      { key: "fsi_political", label: "Political Legitimacy" },
      { key: "fsi_social",    label: "Social Cohesion" },
    ],
  },
  {
    key: "wgi",
    abbr: "WGI",
    label: "Worldwide Governance Indicators",
    source: "World Bank",
    color: "text-blue-400",
    bg: "bg-blue-900/30",
    border: "border-blue-800/40",
    indicators: [
      { key: "wgi_stability",      label: "Political Stability" },
      { key: "wgi_effectiveness",  label: "Govt. Effectiveness" },
      { key: "wgi_accountability", label: "Voice & Accountability" },
    ],
  },
  {
    key: "acled",
    abbr: "ACLED",
    label: "Conflict Location & Event Data",
    source: "ACLED",
    color: "text-orange-400",
    bg: "bg-orange-900/30",
    border: "border-orange-800/40",
    indicators: [
      { key: "acled_deadliness", label: "Conflict Deadliness" },
      { key: "acled_diffusion",  label: "Geographic Diffusion" },
    ],
  },
  {
    key: "icrg",
    abbr: "ICRG",
    label: "Intl. Country Risk Guide",
    source: "PRS Group",
    color: "text-purple-400",
    bg: "bg-purple-900/30",
    border: "border-purple-800/40",
    indicators: [
      { key: "icrg_political", label: "Political Risk" },
      { key: "icrg_financial", label: "Financial Risk" },
      { key: "icrg_economic",  label: "Economic Risk" },
    ],
  },
  {
    key: "gpi",
    abbr: "GPI",
    label: "Global Peace Index",
    source: "Inst. for Economics & Peace",
    color: "text-emerald-400",
    bg: "bg-emerald-900/30",
    border: "border-emerald-800/40",
    indicators: [
      { key: "gpi_conflict",       label: "Ongoing Conflict" },
      { key: "gpi_societal",       label: "Societal Safety" },
      { key: "gpi_militarisation", label: "Militarisation" },
    ],
  },
];

function scoreColor(v: number): string {
  if (v >= 70) return "text-emerald-400";
  if (v >= 45) return "text-amber-400";
  return "text-red-400";
}

function scoreLabel(v: number): { label: string; cls: string } {
  if (v >= 70) return { label: "STABLE",   cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" };
  if (v >= 45) return { label: "ELEVATED", cls: "border-amber-500/30 bg-amber-500/10 text-amber-400" };
  return             { label: "CRITICAL",  cls: "border-red-500/30 bg-red-500/10 text-red-400" };
}

function ScoreBar({ value, color, bg }: { value: number; color: string; bg: string }) {
  return (
    <div className="flex-1 h-1 bg-[#1a2332] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${bg}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export function RiskIndexCard({
  score,
  prevScore,
  fsiScore,
  wgiScore,
  acledScore,
  icrgScore,
  gpiScore,
  breakdown,
  window = "LIVE",
  weightBreakdown,
  methodVersion = "v2",
}: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);

  const delta = prevScore !== undefined ? +(score - prevScore).toFixed(1) : null;
  const isUp   = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;

  const { label, cls } = scoreLabel(score);

  const frameworkScores: Record<string, number | undefined> = {
    fsi: fsiScore, wgi: wgiScore, acled: acledScore, icrg: icrgScore, gpi: gpiScore,
  };

  const hasV2 = fsiScore != null || wgiScore != null;

  return (
    <div className="rounded-sm border border-[#1a2332] bg-[#0d1117] p-4 space-y-3">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            COMPOSITE · CSI {methodVersion === "v2" ? "v2" : ""}
          </p>
          <p className="font-mono text-xs font-semibold text-zinc-300">
            Country Stability Index
          </p>
        </div>
        <span className={`rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cls}`}>
          {window}
        </span>
      </div>

      {/* ── Holistic Score ───────────────────────────────────────────────── */}
      <div className="flex items-end gap-3">
        <span className={`font-mono text-6xl font-bold tabular-nums leading-none ${scoreColor(score)}`}>
          {Math.round(score)}
        </span>
        <div className="mb-2 flex flex-col gap-1">
          {/* Classification label */}
          <span className={`rounded-sm border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${cls}`}>
            {label}
          </span>
          {/* Delta */}
          {delta !== null && (
            <div className={`flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[10px] font-semibold ${
              isUp   ? "bg-emerald-500/20 text-emerald-400" :
              isDown ? "bg-red-500/20 text-red-400" :
              "bg-zinc-700/30 text-zinc-400"
            }`}>
              {isUp   ? <TrendingUp className="h-3 w-3" />   :
               isDown ? <TrendingDown className="h-3 w-3" /> :
               <Minus className="h-3 w-3" />}
              {isUp ? "+" : ""}{delta}
            </div>
          )}
        </div>
      </div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 -mt-1">
        out of 100 · higher = more stable
      </p>

      {/* ── See Detail Toggle ────────────────────────────────────────────── */}
      {hasV2 && (
        <button
          onClick={() => setShowDetail((s) => !s)}
          className="flex w-full items-center justify-between rounded-sm border border-[#1a2332] bg-[#080c10]/80 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-zinc-500 transition-colors hover:border-amber-500/30 hover:text-amber-400"
        >
          <span>SEE DETAIL — FRAMEWORK BREAKDOWN</span>
          {showDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      )}

      {/* ── Framework Breakdown (expanded) ───────────────────────────────── */}
      {showDetail && hasV2 && (
        <div className="space-y-2 border-t border-[#1a2332] pt-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-3">
            INSTITUTIONAL FRAMEWORK SCORES
          </p>
          {FRAMEWORKS.map((fw) => {
            const fwScore = frameworkScores[fw.key] ?? 50;
            const isExpanded = expandedFramework === fw.key;
            return (
              <div key={fw.key} className={`rounded-sm border ${fw.border} ${fw.bg}`}>
                <button
                  onClick={() => setExpandedFramework(isExpanded ? null : fw.key)}
                  className="flex w-full items-center gap-2 px-2.5 py-2"
                >
                  <span className={`font-mono text-[9px] font-bold uppercase tracking-widest w-10 text-left ${fw.color}`}>
                    {fw.abbr}
                  </span>
                  <ScoreBar value={fwScore} color={fw.color} bg={fw.bg.replace("bg-", "bg-").replace("/30", "/60")} />
                  <span className={`font-mono text-xs font-bold tabular-nums w-6 text-right ${scoreColor(fwScore)}`}>
                    {fwScore}
                  </span>
                  {isExpanded ? <ChevronUp className={`h-3 w-3 ${fw.color}`} /> : <ChevronDown className={`h-3 w-3 ${fw.color} opacity-50`} />}
                </button>
                {/* Source label */}
                <p className="px-2.5 pb-1.5 font-mono text-[8px] text-zinc-600">{fw.label} · {fw.source}</p>

                {/* Indicator drill-down */}
                {isExpanded && breakdown && (
                  <div className="border-t border-[#1a2332]/60 mx-2.5 mb-2 pt-2 space-y-1.5">
                    {fw.indicators.map((ind) => {
                      const indScore = breakdown[ind.key] ?? 50;
                      return (
                        <div key={ind.key} className="flex items-center gap-2">
                          <span className="font-mono text-[8px] text-zinc-500 w-32 truncate">{ind.label}</span>
                          <div className="flex-1 h-0.5 bg-[#1a2332] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${fw.bg.replace("/30", "/70")}`}
                              style={{ width: `${Math.min(indScore, 100)}%` }}
                            />
                          </div>
                          <span className={`font-mono text-[9px] tabular-nums w-5 text-right ${scoreColor(indScore)}`}>
                            {indScore}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Attribution */}
          <p className="font-mono text-[8px] text-zinc-700 pt-1 leading-relaxed">
            Methodology: FSI (Fund for Peace) · WGI (World Bank) · ACLED · ICRG (PRS Group) · GPI (IEP)
          </p>
        </div>
      )}

      {/* ── Regional Weights (multi-country mode) ───────────────────────── */}
      {weightBreakdown && weightBreakdown.length > 0 && (
        <div className="pt-2 border-t border-[#1a2332] space-y-1.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">
            REGIONAL WEIGHTS
          </p>
          {weightBreakdown.map((wb) => (
            <div key={wb.code} className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-zinc-400 truncate pr-2">
                {wb.name} ({(wb.weight * 100).toFixed(0)}%)
              </span>
              <span className={`font-mono text-[10px] font-bold tabular-nums ${scoreColor(wb.score)}`}>
                {Math.round(wb.score)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Formula Footnote ─────────────────────────────────────────────── */}
      <div className="rounded-sm border border-[#1a2332] bg-[#080c10]/60 px-3 py-2 space-y-0.5">
        <p className="font-mono text-[9px] text-zinc-500">
          CSI<sub>t</sub> = Σ w<sub>i</sub> · F<sub>i</sub>(t)
        </p>
        <p className="font-mono text-[9px] text-zinc-600">
          w<sub>FSI</sub>=0.25 · w<sub>WGI</sub>=0.25 · w<sub>ACLED</sub>=0.20 · w<sub>ICRG</sub>=0.20 · w<sub>GPI</sub>=0.10
        </p>
        <p className="font-mono text-[9px] text-amber-500/70">
          temporal-decay model · λ=0.05/day
        </p>
      </div>
    </div>
  );
}
