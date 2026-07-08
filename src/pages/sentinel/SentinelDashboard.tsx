import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GlobalRiskMap, type ViewportBounds, type GraphEdge } from "@/components/sentinel/GlobalRiskMap";
import { RiskIndexCard } from "@/components/sentinel/RiskIndexCard";
import { TrendChart } from "@/components/sentinel/TrendChart";
import { TimelineBar } from "@/components/sentinel/TimelineBar";
import { ChatSidebar } from "@/components/sentinel/ChatSidebar";
import { AlertTriageDrawer } from "@/components/sentinel/AlertTriageDrawer";
import { useSentinelRealtime, type SentinelEvent } from "@/hooks/useSentinelRealtime";
import { useSentinelProgressiveLoad } from "@/hooks/useSentinelProgressiveLoad";
import { useSentinelHealth } from "@/hooks/useSentinelHealth";
import { Globe, MessageSquare, Share2 } from "lucide-react";

import { LocationSelector } from "@/components/sentinel/LocationSelector";
import type { LocationSelection } from "@/components/sentinel/LocationTypes";
import { COUNTRY_COORDS } from "@/lib/countryCoords";

// Zoom threshold matching GlobalRiskMap — bbox culling only active when zoomed in
const BBOX_ZOOM_THRESHOLD = 4;
// Hard ceiling before clustering is forced globally
const EVENT_COUNT_CEILING = 10000;

const WINDOWS = ["6H", "24H", "7D", "30D", "90D", "1Y"];
const CATEGORIES = ["ALL", "SECURITY", "ECONOMY", "CULTURE", "INFRASTRUCTURE", "POSITIVE"];

// Generate 7-day trend placeholder from risk score — deterministic to avoid
// re-rendering TrendChart on every parent render (no Math.random)
function buildTrendData(baseScore: number) {
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return days.map((label, i) => {
    const seed = ((baseScore * 17 + i * 31 + 7) % 100) / 100;
    const variance = (seed - 0.5) * 12 * (1 + i * 0.15);
    return {
      label,
      value: Math.max(0, Math.min(100, baseScore + variance)),
    };
  });
}

// Build histogram from events for fallback
function buildTimelineData(events: SentinelEvent[]) {
  const bins: Record<number, number> = {};
  for (let h = 23; h >= 0; h--) bins[h] = 0;
  const now = Date.now();
  events.forEach((e) => {
    const hoursAgo = Math.floor((now - new Date(e.occurred_at).getTime()) / 3600000);
    if (hoursAgo >= 0 && hoursAgo < 24) bins[hoursAgo] = (bins[hoursAgo] || 0) + 1;
  });
  return Object.entries(bins)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([h, count]) => ({ label: `${h}h`, count }));
}

const HEALTH_DOT: Record<string, { dot: string; label: string }> = {
  healthy:    { dot: "bg-emerald-400",  label: "FEED LIVE" },
  degraded:   { dot: "bg-amber-400 animate-pulse", label: "FEED SLOW" },
  stale:      { dot: "bg-amber-500 animate-pulse", label: "FEED STALE" },
  offline:    { dot: "bg-red-500 animate-ping",    label: "FEED OFFLINE" },
  reconnecting: { dot: "bg-amber-400 animate-ping", label: "RECONNECTING" },
};

export default function SentinelDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [location, setLocation] = useState<LocationSelection>({ type: "global" });
  const [window, setWindow] = useState<string>("24H");
  const [category, setCategory] = useState<string>("ALL");
  const [dataSource, setDataSource] = useState<"ALL" | "OSINT" | "BESPOKE">("ALL");
  const [activeTab, setActiveTab] = useState<'analytics' | 'chat'>('analytics');
  const [flashId, setFlashId] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<SentinelEvent[]>([]);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SentinelEvent | null>(null);
  const [bulkEvents, setBulkEvents] = useState<SentinelEvent[] | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "reconnecting" | "disconnected">("disconnected");

  // Phase 3: viewport state for server-side bbox culling
  const [currentZoom, setCurrentZoom] = useState<number>(2.2);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleViewportChange = useCallback((bounds: ViewportBounds, zoom: number) => {
    if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
    viewportDebounceRef.current = setTimeout(() => {
      setCurrentZoom(zoom);
      setViewportBounds(bounds);
    }, 500);
  }, []);

  useEffect(() => () => {
    if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
  }, []);

  const eventIdParam = searchParams.get('eventId');
  useEffect(() => {
    if (eventIdParam && !selectedEvent) {
      const fetchEvent = async () => {
        const { data } = await supabase.from('sentinel_events').select('*').eq('id', eventIdParam).single();
        if (data) {
          let ev = data as unknown as SentinelEvent;
          if ((ev.lat == null || ev.lng == null) && ev.country_code && COUNTRY_COORDS[ev.country_code]) {
            ev = { ...ev, lat: COUNTRY_COORDS[ev.country_code].lat, lng: COUNTRY_COORDS[ev.country_code].lng };
          }
          setLiveEvents(prev => prev.find(e => e.id === ev.id) ? prev : [ev, ...prev]);
          setSelectedEvent(ev);
          setFlashId(ev.id);
          setActiveTab('chat');
        }
        setSearchParams({}, { replace: true });
      };
      fetchEvent();
    }
  }, [eventIdParam, selectedEvent, setSearchParams]);

  // Fetch graph for previously researched events
  useEffect(() => {
    if (selectedEvent && selectedEvent.ai_analysis?.deep_researched && !showGraph) {
      const fetchGraph = async () => {
        const { data, error } = await (supabase as any).rpc('get_event_graph_json', { p_event_id: selectedEvent.id });
        const graphData = data as { nodes: any[]; edges: any[] } | null;
        if (!error && graphData && graphData.nodes && graphData.edges) {
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
      };
      fetchGraph();
    }
  }, [selectedEvent, showGraph]);

  // Phase 4: health monitoring — declared here so we can reference it, healthConfig computed after progressiveLoad

  // Phase 4: progressive background loading for historical events
  const {
    events,
    isLoadingMore,
    cappedAt10k: progressiveCapped,
    error: loadError,
  } = useSentinelProgressiveLoad({
    window,
    category,
    location,
    currentZoom,
    viewportBounds,
    bboxZoomThreshold: BBOX_ZOOM_THRESHOLD,
    dataSource,
  });

  const health = useSentinelHealth(realtimeStatus);
  // If REST data is flowing, don't surface RECONNECTING to the user — only show it when there's truly no data.
  const effectiveStatus: string =
    realtimeStatus === "connected"
      ? health.status
      : events.length > 0
      ? health.status
      : realtimeStatus === "reconnecting"
      ? "reconnecting"
      : health.status;
  const healthConfig = HEALTH_DOT[effectiveStatus] ?? HEALTH_DOT["reconnecting"];

  // Fetch timeline bins from server-side aggregation
  const { data: timelineBins = [] } = useQuery({
    queryKey: ["sentinel-timeline", location],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_event_timeline_bins", {
        p_country_code: location.type === "country" ? location.code : null,
        p_hours: 24
      });
      if (error) return [];
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  // Fetch risk score for selected location
  // Cast via `any` because `risk_scores` exists in the DB but is not yet
  // reflected in the auto-generated Supabase TypeScript types.
  type RiskScoreRow = {
    score: number;
    security_score: number | null;
    economy_score: number | null;
    social_score: number | null;
    breakdown: any;
  };
  const { data: riskScoreData } = useQuery<RiskScoreRow | null>({
    queryKey: ["sentinel-risk-score", location],
    queryFn: async (): Promise<RiskScoreRow | null> => {
      if (location.type === "global") return null;
      const countryCode = location.type === "country" ? location.code : null;
      if (!countryCode) return null;
      const { data, error } = await (supabase as any)
        .from("risk_scores")
        .select("score, security_score, economy_score, social_score, breakdown")
        .eq("country_code", countryCode)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as RiskScoreRow | null;
    },
    refetchInterval: 120000,
  });


  useSentinelRealtime({
    onEvent: useCallback((event: SentinelEvent) => {
      // Data source filter
      if (dataSource === "OSINT" && event.is_proprietary) return;
      if (dataSource === "BESPOKE" && !event.is_proprietary) return;

      // Category filter
      if (category === "SECURITY" && event.event_type !== "security") return;
      if (category === "ECONOMY" && !["economy", "baseline_metric"].includes(event.event_type)) return;
      if (category === "CULTURE" && event.event_type !== "social") return;
      if (category === "INFRASTRUCTURE" && !["infrastructure", "environmental"].includes(event.event_type)) return;
      if (category === "POSITIVE" && event.event_type !== "positive") return;

      let shouldInclude = location.type === "global";
      if (!shouldInclude && location.type === "country") {
        shouldInclude = event.country_code === location.code;
      } else if (!shouldInclude && location.type === "region") {
        shouldInclude = location.countries.some(c => c.code === event.country_code);
      }
      if (shouldInclude) {
        setLiveEvents((prev) => [event, ...prev].slice(0, 50));
        setFlashId(event.id);
        setTimeout(() => setFlashId(null), 3000);
      }
    }, [location, dataSource, category]),
    onRiskUpdate: useCallback((score: any) => {
      if (location.type === "country" && score.country_code === location.code) {
        setLiveScore(score.score);
      }
    }, [location]),
    onStatusChange: setRealtimeStatus,
  });

  // Historical events with country-coord fallback; live events kept separate (bypass clustering)
  const historicalEvents = events
    .filter((e) => !liveEvents.find((le) => le.id === e.id))
    .map(e => {
      if (e.lat == null || e.lng == null) {
        if (e.country_code && COUNTRY_COORDS[e.country_code]) {
          return { ...e, lat: COUNTRY_COORDS[e.country_code].lat, lng: COUNTRY_COORDS[e.country_code].lng };
        }
      }
      return e;
    });

  const enrichedLiveEvents = liveEvents.map(e => {
    if ((e.lat == null || e.lng == null) && e.country_code && COUNTRY_COORDS[e.country_code]) {
      return { ...e, lat: COUNTRY_COORDS[e.country_code].lat, lng: COUNTRY_COORDS[e.country_code].lng };
    }
    return e;
  });

  const allEvents = [...enrichedLiveEvents, ...historicalEvents];

  const displayedEvents = historicalEvents.filter((e) => {
    if (category === "ALL") return true;
    if (category === "SECURITY") return e.event_type === "security";
    if (category === "ECONOMY") return e.event_type === "economy" || e.event_type === "baseline_metric";
    if (category === "CULTURE") return e.event_type === "social";
    if (category === "INFRASTRUCTURE") return e.event_type === "infrastructure" || e.event_type === "environmental";
    if (category === "POSITIVE") return e.event_type === "positive";
    return true;
  });

  const isCappedAt10k = progressiveCapped || allEvents.length >= EVENT_COUNT_CEILING;

  const score = liveScore ?? riskScoreData?.score ?? 62;
  const trendData = buildTrendData(score);
  const timelineData = timelineBins.length > 0
    ? timelineBins.map((b: any) => ({ label: b.hour_label, count: b.event_count }))
    : buildTimelineData(liveEvents);

  // High-severity events for alert triage (severity ≥ 8)
  const triageEvents = allEvents.filter((e) => (e.severity || 0) >= 8);

  return (
    <div className="flex h-[calc(100vh-44px)] bg-[#080c10]">
      {/* ── LEFT: Map ──────────────────────────────────────────────────────── */}
      <div className="relative flex-1">
        {/* Top controls overlay */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          {/* Location selector */}
          <div className="flex gap-1">
            <LocationSelector value={location} onChange={setLocation} />
            <select
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value as any)}
              className="bg-[#0d1117]/80 border border-[#1a2332] rounded-sm px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-400 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">ALL DATA</option>
              <option value="OSINT">OSINT ONLY</option>
              <option value="BESPOKE">BESPOKE ONLY</option>
            </select>
          </div>

          {/* Time window */}
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                  window === w
                    ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                    : "border-[#1a2332] bg-[#0d1117]/80 text-zinc-600 hover:text-zinc-300"
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Category + graph toggle */}
          <div className="flex gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                  category === c
                    ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                    : "border-[#1a2332] bg-[#0d1117]/80 text-zinc-600 hover:text-zinc-300"
                }`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => setShowGraph((v) => !v)}
              title="Toggle correlation graph"
              className={`rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                showGraph
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                  : "border-[#1a2332] bg-[#0d1117]/80 text-zinc-600 hover:text-zinc-300"
              }`}
            >
              <Share2 className="h-2.5 w-2.5 inline" />
            </button>
          </div>
        </div>

        {/* Health status dot — top right */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {loadError && (
            <span className="rounded-sm border border-red-500/30 bg-red-500/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-red-400">
              LOAD ERROR: {typeof loadError === 'string' ? loadError : JSON.stringify(loadError)}
            </span>
          )}
          <div className="flex items-center gap-1.5 rounded-sm border border-[#1a2332] bg-[#0d1117]/80 px-2 py-1 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${healthConfig.dot}`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${healthConfig.dot.replace("animate-ping", "").replace("animate-pulse", "").trim()}`} />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
              {healthConfig.label}
            </span>
            {health.minutesSinceIngest !== null && (
              <span className="font-mono text-[9px] text-zinc-600">
                · {health.minutesSinceIngest}m
              </span>
            )}
          </div>
        </div>

        {/* Empty state */}
        {displayedEvents.length === 0 && enrichedLiveEvents.length === 0 && !isLoadingMore && (
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2 opacity-30">
              <Globe className="h-12 w-12 text-zinc-600" />
              <p className="font-mono text-xs uppercase tracking-widest text-zinc-600">
                AWAITING GDELT FEED
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton — shown on initial load before first events arrive */}
        {displayedEvents.length === 0 && isLoadingMore && (
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 opacity-50">
              <div className="h-12 w-12 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
              <p className="font-mono text-xs uppercase tracking-widest text-zinc-600">
                LOADING EVENT DATA…
              </p>
            </div>
          </div>
        )}

        {/* 10k ceiling badge */}
        {isCappedAt10k && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 pointer-events-none">
            <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400">
              10K EVENT LIMIT · ZOOM IN FOR MORE
            </span>
          </div>
        )}

        <GlobalRiskMap
          events={displayedEvents}
          liveEvents={enrichedLiveEvents}
          flashEventId={flashId}
          selectedEventId={selectedEvent?.id}
          forceClustering={isCappedAt10k}
          showGraph={showGraph}
          graphEdges={graphEdges}
          onEventClick={(event) => {
            setBulkEvents(null);
            setSelectedEvent(event);
            setShowGraph(false);
            setGraphEdges([]);
            setActiveTab('chat');
          }}
          onEventsLassoed={(events) => {
            setSelectedEvent(null);
            setBulkEvents(events);
            setShowGraph(false);
            setGraphEdges([]);
            setActiveTab('chat');
          }}
          onViewportChange={handleViewportChange}
        />

        {/* Alert Triage Drawer — Phase 3 */}
        <AlertTriageDrawer
          events={triageEvents}
          onInvestigate={(event) => {
            setSelectedEvent(event);
            setActiveTab('chat');
          }}
        />
      </div>

      {/* ── RIGHT: Panel stack ──────────────────────────────────────────────── */}
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
            onVirtualEventCreated={async (eventId) => {
              // Only switch focus to the virtual event if the user came from a
              // lasso/bulk context (no prior selected event). If they already had a
              // specific event clicked, keep that event selected — the virtual event
              // is only used to anchor the deep-research graph in the DB, not to
              // hijack what the user is looking at on the map.
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
                // Still clear bulk events but leave the focused event untouched
                setBulkEvents(null);
              }
            }}
            onGraphGenerated={(graphData) => {
              if (graphData && graphData.nodes && graphData.edges) {
                // Build coordinate index from nodes
                const coordIndex: Record<string, [number, number]> = {};
                graphData.nodes.forEach((n: any) => {
                  if (n.lat != null && n.lng != null) {
                    coordIndex[n.label] = [n.lng, n.lat]; // Deck.gl expects [lng, lat]
                  }
                });

                // Build edges
                const newEdges: GraphEdge[] = [];
                graphData.edges.forEach((e: any) => {
                  const source = coordIndex[e.source_label];
                  const target = coordIndex[e.target_label];
                  if (source && target) {
                    newEdges.push({
                      source,
                      target,
                      weight: e.weight || 1.0
                    });
                  }
                });

                setGraphEdges(newEdges);
                setShowGraph(true);
              }
            }}
            onClose={() => {
              setSelectedEvent(null);
              setBulkEvents(null);
              setShowGraph(false);
              setGraphEdges([]);
              setActiveTab('analytics');
            }}
          />
        ) : (
          <div className="space-y-2 p-3 overflow-y-auto">
            <RiskIndexCard
              score={score}
              prevScore={riskScoreData?.score ? riskScoreData.score - 1.2 : undefined}
              securityScore={riskScoreData?.security_score ?? 45}
              economyScore={riskScoreData?.economy_score ?? 71}
              socialScore={riskScoreData?.social_score ?? 69}
              window={window}
              weightBreakdown={riskScoreData?.breakdown}
            />
            <TrendChart data={trendData} />
            <TimelineBar
              data={timelineData}
              totalEvents={allEvents.length}
              window={window}
              isLoadingMore={isLoadingMore}
            />
          </div>
        )}
      </div>
    </div>
  );
}