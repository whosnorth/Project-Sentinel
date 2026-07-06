import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RiskIndexCard } from "@/components/sentinel/RiskIndexCard";
import { Search, Star, StarOff, Pin } from "lucide-react";
import { ISO_COUNTRIES, ISO_COUNTRY_MAP } from "@/constants/isoCountries";

const STORAGE_KEY = "sentinel_pinned_countries";
const DEFAULT_PINS = ["NG", "UA", "IQ", "SS", "YE", "SY", "CD", "ET", "AF", "MM"];

function getStoredPins(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_PINS;
  } catch {
    return DEFAULT_PINS;
  }
}

function scoreToBadge(score: number): { cls: string; label: string } {
  if (score >= 70) return { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "STABLE" };
  if (score >= 45) return { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", label: "ELEVATED" };
  return { cls: "border-red-500/30 bg-red-500/10 text-red-400", label: "CRITICAL" };
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

export default function RiskMatrix() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [pinnedCodes, setPinnedCodes] = useState<string[]>(getStoredPins);
  const [analyzingCode, setAnalyzingCode] = useState<string | null>(null);

  const { data: scores = [], refetch } = useQuery({
    queryKey: ["sentinel-all-risk-scores-v2"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_country_stability_latest")
        .select("*");
      if (error) {
        // Fallback: query sentinel_risk_scores directly
        const { data: fallback, error: fbErr } = await supabase
          .from("sentinel_risk_scores")
          .select("*")
          .order("computed_at", { ascending: false })
          .limit(200);
        if (fbErr) throw fbErr;
        // Deduplicate: latest per country
        const seen = new Set<string>();
        return (fallback ?? []).filter((s: any) => {
          if (seen.has(s.country_code)) return false;
          seen.add(s.country_code);
          return true;
        });
      }
      return data ?? [];
    },
    refetchInterval: 120000,
  });

  // Build a lookup map by country code
  const scoreMap = useMemo<Record<string, any>>(() => {
    const m: Record<string, any> = {};
    scores.forEach((s: any) => { m[s.country_code] = s; });
    return m;
  }, [scores]);

  // Top 12 most at-risk countries (lowest CSI score) to show by default
  const topAtRisk = useMemo(() => {
    return [...scores]
      .sort((a: any, b: any) => (a.score ?? 50) - (b.score ?? 50))
      .slice(0, 12)
      .map((s: any) => s.country_code as string);
  }, [scores]);

  // Countries to display: pins + top-at-risk, deduped
  const displayCodes = useMemo(() => {
    const all = [...new Set([...pinnedCodes, ...topAtRisk])];
    return all;
  }, [pinnedCodes, topAtRisk]);

  // Search filter: shows results from the full ISO list
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return ISO_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search]);

  function togglePin(code: string) {
    setPinnedCodes((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function triggerAnalysis(code: string) {
    setAnalyzingCode(code);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sentinel-gpr-calculator`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ country_code: code }),
        }
      );
      await refetch();
    } finally {
      setAnalyzingCode(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#080c10] p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
          SENTINEL · MATRIX
        </p>
        <h1 className="font-mono text-xl font-bold text-amber-400">Risk Matrix</h1>
        <p className="font-mono text-[10px] text-zinc-500">
          CSI v2 · 5-framework composite · FSI · WGI · ACLED · ICRG · GPI · 100 = most stable
        </p>
      </div>

      {/* Country Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search any country (name or ISO code)…"
          className="w-full rounded-sm border border-[#1a2332] bg-[#0d1117] pl-9 pr-4 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-sm border border-[#1a2332] bg-[#0d1117] shadow-lg overflow-hidden">
            {searchResults.map((c) => {
              const s = scoreMap[c.code];
              const { cls, label } = scoreToBadge(s?.score ?? 50);
              const isPinned = pinnedCodes.includes(c.code);
              return (
                <div
                  key={c.code}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-[#1a2332] transition-colors"
                >
                  <button
                    onClick={() => navigate(`/sentinel/country/${c.code}`)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <span className="font-mono text-[10px] font-bold text-amber-400 w-8">{c.code}</span>
                    <span className="font-mono text-[10px] text-zinc-300">{c.name}</span>
                    {s ? (
                      <span className={`ml-auto rounded-sm border px-1.5 py-0.5 font-mono text-[8px] ${cls}`}>{label}</span>
                    ) : (
                      <span className="ml-auto font-mono text-[8px] text-zinc-600">NO DATA</span>
                    )}
                  </button>
                  <button
                    onClick={() => togglePin(c.code)}
                    className={`transition-colors ${isPinned ? "text-amber-400" : "text-zinc-600 hover:text-zinc-300"}`}
                    title={isPinned ? "Unpin" : "Pin to matrix"}
                  >
                    {isPinned ? <Star className="h-3 w-3 fill-current" /> : <StarOff className="h-3 w-3" />}
                  </button>
                  {!s && (
                    <button
                      onClick={() => triggerAnalysis(c.code)}
                      disabled={analyzingCode === c.code}
                      className="font-mono text-[8px] text-amber-400 border border-amber-500/30 rounded-sm px-2 py-0.5 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      {analyzingCode === c.code ? "ANALYZING…" : "ANALYZE"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <Pin className="h-3 w-3 text-amber-400" />
          <span className="font-mono text-[9px] text-zinc-500">PINNED</span>
        </div>
        {[
          { color: "bg-emerald-500", label: "≥70 STABLE" },
          { color: "bg-amber-500", label: "45-70 ELEVATED" },
          { color: "bg-red-500", label: "<45 CRITICAL" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${color}`} />
            <span className="font-mono text-[9px] text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Country Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayCodes.map((code) => {
          const s = scoreMap[code];
          const name = ISO_COUNTRY_MAP[code] ?? code;
          const isPinned = pinnedCodes.includes(code);
          const score = s?.score ?? null;
          const { cls, label } = score !== null ? scoreToBadge(score) : { cls: "border-zinc-700/30 bg-zinc-800/20 text-zinc-500", label: "NO DATA" };

          return (
            <div
              key={code}
              className="rounded-sm border border-[#1a2332] bg-[#0d1117] overflow-hidden cursor-pointer hover:border-amber-500/30 transition-colors group"
              onClick={() => navigate(`/sentinel/country/${code}`)}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2332]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-amber-400">{code}</span>
                  <span className="font-mono text-[9px] text-zinc-500 truncate max-w-[110px]">{name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[8px] ${cls}`}>{label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(code); }}
                    className={`transition-colors ${isPinned ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`}
                  >
                    {isPinned ? <Star className="h-3 w-3 fill-current" /> : <StarOff className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Score body */}
              <div className="px-3 py-3 space-y-2">
                {score !== null ? (
                  <>
                    {/* Big score */}
                    <div className="flex items-baseline gap-2">
                      <span className={`font-mono text-3xl font-bold tabular-nums ${score >= 70 ? "text-emerald-400" : score >= 45 ? "text-amber-400" : "text-red-400"}`}>
                        {Math.round(score)}
                      </span>
                      <span className="font-mono text-[9px] text-zinc-600">/100</span>
                    </div>
                    {/* Score bar */}
                    <div className="h-1 w-full bg-[#1a2332] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    {/* Framework mini-bars */}
                    {(s?.fsi_score != null) && (
                      <div className="space-y-1 pt-1">
                        {[
                          { abbr: "FSI", val: s.fsi_score,   color: "bg-red-500" },
                          { abbr: "WGI", val: s.wgi_score,   color: "bg-blue-500" },
                          { abbr: "ACLED", val: s.acled_score, color: "bg-orange-500" },
                          { abbr: "ICRG", val: s.icrg_score,  color: "bg-purple-500" },
                          { abbr: "GPI",  val: s.gpi_score,   color: "bg-emerald-500" },
                        ].map(({ abbr, val, color }) => val != null && (
                          <div key={abbr} className="flex items-center gap-2">
                            <span className="font-mono text-[8px] text-zinc-600 w-8">{abbr}</span>
                            <div className="flex-1 h-0.5 bg-[#1a2332] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${color} opacity-70`} style={{ width: `${val}%` }} />
                            </div>
                            <span className="font-mono text-[8px] text-zinc-500 w-5 text-right">{Math.round(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {s?.computed_at && (
                      <p className="font-mono text-[8px] text-zinc-700">
                        Updated {new Date(s.computed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="font-mono text-[9px] text-zinc-600">No stability data</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); triggerAnalysis(code); }}
                      disabled={analyzingCode === code}
                      className="font-mono text-[9px] text-amber-400 border border-amber-500/30 rounded-sm px-2 py-1 hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
                    >
                      {analyzingCode === code ? "ANALYZING…" : "▶ ANALYZE THIS COUNTRY"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
