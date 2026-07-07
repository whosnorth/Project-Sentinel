import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { RiskIndexCard } from "@/components/sentinel/RiskIndexCard";
import { TrendChart } from "@/components/sentinel/TrendChart";
import { HeatMatrix } from "@/components/sentinel/HeatMatrix";
import { LiveWirePanel } from "@/components/sentinel/LiveWirePanel";
import { GlobalRiskMap } from "@/components/sentinel/GlobalRiskMap";
import { useSentinelRealtime, type SentinelEvent } from "@/hooks/useSentinelRealtime";
import { ArrowLeft, Search, ChevronDown, Zap, Globe, MessageSquare } from "lucide-react";
import { ISO_COUNTRIES, ISO_COUNTRY_MAP } from "@/constants/isoCountries";
import { ChatSidebar } from "@/components/sentinel/ChatSidebar";
import type { GraphEdge, ViewportBounds } from "@/components/sentinel/GlobalRiskMap";

export default function CountryIntelligence() {
  const { code = "NG" } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [liveEvents, setLiveEvents] = useState<SentinelEvent[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [analyzingCode, setAnalyzingCode] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'analytics' | 'chat'>('analytics');
  const [selectedEvent, setSelectedEvent] = useState<SentinelEvent | null>(null);
  const [bulkEvents, setBulkEvents] = useState<SentinelEvent[] | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);

  const currentCode = code.toUpperCase();
  const countryName = ISO_COUNTRY_MAP[currentCode] ?? currentCode;

  // Filter ISO countries for the picker
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return ISO_COUNTRIES.slice(0, 20);
    const q = countrySearch.toLowerCase();
    return ISO_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [countrySearch]);

  // Events for this country
  const { data: events = [], refetch } = useQuery({
    queryKey: ["sentinel-events-country", currentCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sentinel_events")
        .select("*")
        .eq("country_code", currentCode)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SentinelEvent[];
    },
    refetchInterval: 60000,
  });

  // Risk score for this country
  const { data: riskScore, refetch: refetchRisk } = useQuery({
    queryKey: ["sentinel-risk-score-country", currentCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_scores")
        .select("*")
        .eq("country_code", currentCode)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  useSentinelRealtime({
    onNewEvent: (e) => {
      if (e.country_code === currentCode) {
        setLiveEvents((prev) => [e, ...prev].slice(0, 30));
      }
    },
  });

  const allEvents = [
    ...liveEvents,
    ...events.filter((e) => !liveEvents.find((le) => le.id === e.id)),
  ];

  const score = riskScore?.score ?? null;

  async function triggerAnalysis() {
    setAnalyzingCode(currentCode);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      await fetch(
        `${SUPABASE_URL}/functions/v1/sentinel-gpr-calculator`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ country_code: currentCode }),
        }
      );
      await refetchRisk();
    } finally {
      setAnalyzingCode(null);
    }
  }

  return (
    <div className="flex h-[calc(100vh-44px)] flex-col bg-[#080c10]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b border-[#1a2332] px-6 py-3">
        <button
          onClick={() => navigate("/matrix")}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Country name + code */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            THEATRE · {currentCode}
          </p>
          <p className="font-mono text-sm font-bold text-amber-400">
            {countryName} / NATIONAL STABILITY · LIVE
          </p>
        </div>

        {/* Country picker */}
        <div className="ml-auto relative">
          <button
            onClick={() => setShowPicker((s) => !s)}
            className="flex items-center gap-2 rounded-sm border border-[#1a2332] bg-[#0d1117] px-3 py-1.5 font-mono text-[10px] text-zinc-400 hover:border-amber-500/40 hover:text-amber-400 transition-colors"
          >
            <Search className="h-3 w-3" />
            Switch country
            <ChevronDown className="h-3 w-3" />
          </button>

          {showPicker && (
            <div className="absolute top-full right-0 z-50 mt-1 w-64 rounded-sm border border-[#1a2332] bg-[#0d1117] shadow-2xl">
              <div className="p-2 border-b border-[#1a2332]">
                <input
                  autoFocus
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search country…"
                  className="w-full rounded-sm border border-[#1a2332] bg-[#080c10] px-2 py-1.5 font-mono text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      navigate(`/country/${c.code}`);
                      setShowPicker(false);
                      setCountrySearch("");
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[10px] transition-colors hover:bg-[#1a2332] ${
                      c.code === currentCode ? "text-amber-400" : "text-zinc-400"
                    }`}
                  >
                    <span className="w-7 font-bold text-amber-500/70">{c.code}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Map */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 min-h-0">
            <GlobalRiskMap 
              events={allEvents}
              selectedEventId={selectedEvent?.id}
              onEventClick={(ev) => {
                setSelectedEvent(ev);
                setActiveTab('chat');
                setBulkEvents(null);
                if (ev.ai_analysis?.deep_researched) {
                  setShowGraph(true);
                } else {
                  setShowGraph(false);
                  setGraphEdges([]);
                }
              }}
              graphEdges={showGraph ? graphEdges : undefined}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-[#1a2332] bg-[#080c10] flex flex-col h-full overflow-hidden">
          {/* Tab switcher */}
          <div className="flex items-center border-b border-[#1a2332] p-2 bg-[#0a0e14]">
            <div className="flex w-full rounded-sm bg-[#121822] p-1 border border-[#1a2332]">
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-sm py-1.5 font-mono text-[9px] uppercase tracking-widest transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-[#1a2332] text-amber-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <Globe className="h-3 w-3" />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-sm py-1.5 font-mono text-[9px] uppercase tracking-widest transition-all ${
                  activeTab === 'chat'
                    ? 'bg-[#1a2332] text-amber-400'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                Intel Chat
              </button>
            </div>
          </div>

          {activeTab === 'chat' ? (
            <ChatSidebar
              selectedEvent={selectedEvent}
              bulkEvents={bulkEvents}
              onClose={() => {
                setActiveTab('analytics');
                setSelectedEvent(null);
                setBulkEvents(null);
              }}
              onVirtualEventCreated={async (eventId) => {
                if (!selectedEvent) {
                  const { data } = await supabase
                    .from("sentinel_events")
                    .select("*")
                    .eq("id", eventId)
                    .single();
                  if (data) {
                    setBulkEvents(null);
                    setSelectedEvent(data as unknown as SentinelEvent);
                  }
                } else {
                  setBulkEvents(null);
                }
              }}
              onGraphGenerated={(graphData) => {
                if (graphData && graphData.nodes && graphData.edges) {
                  const coordIndex: Record<string, [number, number]> = {};
                  graphData.nodes.forEach((n: any) => {
                    if (n.lat != null && n.lng != null) {
                      coordIndex[n.label] = [n.lng, n.lat];
                    }
                  });
                  const newEdges: GraphEdge[] = [];
                  graphData.edges.forEach((e: any) => {
                    const source = coordIndex[e.source_label];
                    const target = coordIndex[e.target_label];
                    if (source && target) {
                      newEdges.push({ source, target, weight: e.weight || 1.0 });
                    }
                  });
                  setGraphEdges(newEdges);
                  setShowGraph(true);
                }
              }}
            />
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 p-3">
              {/* No data state + on-demand analysis */}
              {score === null && (
                <div className="rounded-sm border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                  <p className="font-mono text-[9px] text-amber-400/80 leading-relaxed">
                    No stability data found for {countryName}. Run an on-demand analysis to generate a CSI v2 score.
                  </p>
                  <button
                    onClick={triggerAnalysis}
                    disabled={analyzingCode === currentCode}
                    className="flex w-full items-center justify-center gap-2 rounded-sm bg-amber-500 px-3 py-1.5 font-mono text-[10px] font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
                  >
                    <Zap className="h-3 w-3" />
                    {analyzingCode === currentCode ? "ANALYZING…" : "ANALYZE THIS COUNTRY"}
                  </button>
                </div>
              )}

              {/* RiskIndexCard v2 */}
              {score !== null && (
                <RiskIndexCard
                  score={score}
                  fsiScore={(riskScore as any)?.fsi_score ?? undefined}
                  wgiScore={(riskScore as any)?.wgi_score ?? undefined}
                  acledScore={(riskScore as any)?.acled_score ?? undefined}
                  icrgScore={(riskScore as any)?.icrg_score ?? undefined}
                  gpiScore={(riskScore as any)?.gpi_score ?? undefined}
                  breakdown={(riskScore as any)?.pillar_breakdown ?? undefined}
                  methodVersion={(riskScore as any)?.method_version ?? "v1"}
                />
              )}

              {/* Dynamic HeatMatrix for any country */}
              <HeatMatrix countryCode={currentCode} />

              {/* Live Wire */}
              <div className="h-96">
                <LiveWirePanel 
                  events={allEvents} 
                  onRefresh={() => refetch()} 
                  onEventSelect={(ev) => {
                    setSelectedEvent(ev);
                    setActiveTab('chat');
                    setBulkEvents(null);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
