import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer, LineLayer } from "@deck.gl/layers";
import { FlyToInterpolator, WebMercatorViewport } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import type { PickingInfo } from "@deck.gl/core";
import type { SentinelEvent } from "@/hooks/useSentinelRealtime";

// Carto dark matter tile URL — no API key required
const CARTO_DARK =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INITIAL_VIEW = {
  longitude: 20,
  latitude: 10,
  zoom: 2.2,
  pitch: 0,
  bearing: 0,
};

// Zoom threshold: below this, use clustering; at or above, use raw pins
const CLUSTER_ZOOM_THRESHOLD = 4;

type EventColor = [number, number, number, number];

// Priority order for cluster colour: security > infrastructure/environmental > economy > social > positive
const EVENT_TYPE_PRIORITY: Record<string, number> = {
  security: 0,
  infrastructure: 1,
  environmental: 1,
  economy: 2,
  baseline_metric: 2,
  social: 3,
  positive: 4,
};

function getEventColor(event: SentinelEvent): EventColor {
  switch (event.event_type) {
    case "security": return event.severity >= 7 ? [239, 68, 68, 230] : [239, 68, 68, 160];
    case "economy":
    case "baseline_metric": return [245, 158, 11, 200];
    case "social":   return [59, 130, 246, 200];
    case "positive": return [34, 197, 94, 200];
    case "infrastructure":
    case "environmental": return [249, 115, 22, 240];
    case "custom_internal_event": return [168, 85, 247, 240]; // Purple (bg-purple-500)
    default:         return [161, 161, 170, 160];
  }
}

function getEventRadius(event: SentinelEvent): number {
  // Make thermal anomalies extremely small so they don't drown out geopolitical events
  if (event.event_type === "infrastructure" && event.headline.includes("Thermal Anomaly")) {
    return 5000 + (event.severity || 5) * 2000;
  }
  return 30000 + (event.severity || 5) * 25000;
}

function getDominantEvent(objects: SentinelEvent[]): SentinelEvent | null {
  if (!objects || objects.length === 0) return null;
  return objects.reduce((best, e) => {
    const priority = EVENT_TYPE_PRIORITY[e.event_type] ?? 99;
    const bestPriority = EVENT_TYPE_PRIORITY[best.event_type] ?? 99;
    if (priority < bestPriority) return e;
    if (priority === bestPriority && (e.severity || 0) > (best.severity || 0)) return e;
    return best;
  }, objects[0]);
}

// Returns the colour for a cluster based on the highest-priority (worst-case) event inside it
function getClusterColor(objects: SentinelEvent[]): EventColor {
  const dominant = getDominantEvent(objects);
  if (!dominant) return [161, 161, 170, 200];
  const base = getEventColor(dominant);
  return [base[0], base[1], base[2], 220] as EventColor;
}

export type ViewportBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type GraphEdge = {
  source: [number, number];
  target: [number, number];
  weight: number;
};

type Props = {
  events: SentinelEvent[];
  liveEvents?: SentinelEvent[];
  flashEventId?: string | null;
  selectedEventId?: string | null;
  forceClustering?: boolean;
  showGraph?: boolean;
  graphEdges?: GraphEdge[];
  onEventClick?: (event: SentinelEvent) => void;
  onViewportChange?: (bounds: ViewportBounds, zoom: number) => void;
  onEventsLassoed?: (events: SentinelEvent[]) => void;
};

type TooltipState = {
  x: number;
  y: number;
  event: SentinelEvent;
} | null;

type ClusterObject = {
  count: number;
  position: [number, number];
  objects: SentinelEvent[];
};

export function GlobalRiskMap({
  events,
  liveEvents = [],
  flashEventId,
  selectedEventId,
  forceClustering = false,
  showGraph = false,
  graphEdges = [],
  onEventClick,
  onViewportChange,
  onEventsLassoed,
}: Props) {
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [clusters, setClusters] = useState<ClusterObject[]>([]);
  
  const [isLassoing, setIsLassoing] = useState(false);
  const [lassoStart, setLassoStart] = useState<[number, number] | null>(null);
  const [lassoEnd, setLassoEnd] = useState<[number, number] | null>(null);

  // Debounced stable zoom — cluster recomputation only fires after user stops scrolling
  const [stableZoom, setStableZoom] = useState(INITIAL_VIEW.zoom);
  const zoomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashRef = useRef<Set<string>>(new Set());

  const isClusteringActive =
    !selectedEventId && (forceClustering || viewState.zoom < CLUSTER_ZOOM_THRESHOLD);

  // Track flashing event IDs for glow animation
  useEffect(() => {
    if (flashEventId) {
      flashRef.current.add(flashEventId);
      const timer = setTimeout(() => {
        flashRef.current.delete(flashEventId);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [flashEventId]);

  // Cleanup zoom debounce on unmount
  useEffect(() => () => {
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
  }, []);

  // Listen for SHIFT key to toggle lasso mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsLassoing(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsLassoing(false);
        setLassoStart(null);
        setLassoEnd(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const validEvents = useMemo(
    () => {
      return [...events]
        .filter((e) => e.lat != null && e.lng != null)
        .sort((a, b) => {
          // Priority: lower number = more important. We want more important at the END of the array (drawn on top)
          const pA = EVENT_TYPE_PRIORITY[a.event_type] ?? 99;
          const pB = EVENT_TYPE_PRIORITY[b.event_type] ?? 99;
          if (pA !== pB) return pB - pA;
          return (a.severity || 0) - (b.severity || 0);
        });
    },
    [events]
  );
  const validLive = useMemo(
    () => {
      let filtered = liveEvents.filter((e) => e.lat != null && e.lng != null);
      if (selectedEventId) {
        filtered = filtered.filter((e) => e.id === selectedEventId);
      }
      return filtered;
    },
    [liveEvents, selectedEventId]
  );

  // Cluster recomputation — keyed on stableZoom (debounced), not the continuous viewState.zoom float
  useEffect(() => {
    if (!isClusteringActive || validEvents.length === 0) {
      setClusters([]);
      return;
    }
    const cellDeg = Math.pow(2, 5 - Math.floor(stableZoom));
    const grid: Record<string, SentinelEvent[]> = {};
    validEvents.forEach((e) => {
      const key = `${Math.floor(e.lat! / cellDeg)}_${Math.floor(e.lng! / cellDeg)}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push(e);
    });
    const built: ClusterObject[] = Object.values(grid).map((bucket) => {
      const lat = bucket.reduce((s, e) => s + e.lat!, 0) / bucket.length;
      const lng = bucket.reduce((s, e) => s + e.lng!, 0) / bucket.length;
      return { count: bucket.length, position: [lng, lat], objects: bucket };
    });
    setClusters(built);
  }, [isClusteringActive, validEvents, stableZoom]);

  // Fly to selected event
  useEffect(() => {
    if (selectedEventId) {
      const event = validEvents.find((e) => e.id === selectedEventId);
      if (event && event.lng != null && event.lat != null) {
        setViewState((prev: any) => ({
          ...prev,
          longitude: event.lng,
          latitude: event.lat,
          zoom: Math.max(prev.zoom, 4.5),
          pitch: 30,
          transitionDuration: 1200,
          transitionInterpolator: new FlyToInterpolator(),
        }));
      }
    } else {
      setViewState({
        ...INITIAL_VIEW,
        transitionDuration: 1200,
        transitionInterpolator: new FlyToInterpolator(),
      });
    }
  }, [selectedEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewStateChange = useCallback(
    ({ viewState: vs }: { viewState: any }) => {
      setViewState(vs);

      // Debounce stable zoom — only update after 200ms pause in scrolling
      if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
      zoomDebounceRef.current = setTimeout(() => setStableZoom(vs.zoom), 200);

      // Bubble viewport bounds to parent for bbox culling
      if (onViewportChange) {
        try {
          const vp = new WebMercatorViewport(vs);
          const nw = vp.unproject([0, 0]);
          const se = vp.unproject([vs.width || window.innerWidth, vs.height || window.innerHeight]);
          onViewportChange(
            { north: nw[1], south: se[1], west: nw[0], east: se[0] },
            vs.zoom
          );
        } catch {
          // Viewport not ready — ignore
        }
      }
    },
    [onViewportChange]
  );

  const handleHover = useCallback((info: PickingInfo) => {
    if (info.object) {
      const obj = info.object as any;
      const event: SentinelEvent = obj.objects ? getDominantEvent(obj.objects) : obj;
      setTooltip({ x: info.x, y: info.y, event });
    } else {
      setTooltip(null);
    }
  }, []);

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info.object) {
        const obj = info.object as any;
        const event: SentinelEvent = obj.objects ? getDominantEvent(obj.objects) : obj;
        onEventClick?.(event);
      }
    },
    [onEventClick]
  );

  const displayEvents = useMemo(
    () => selectedEventId ? validEvents.filter((e) => e.id === selectedEventId) : validEvents,
    [validEvents, selectedEventId]
  );

  // ── MEMOIZED LAYER DEFINITIONS ────────────────────────────────────────────
  // Each layer is only re-instantiated when its specific data/config changes.
  // Without useMemo, Deck.gl recreates GPU buffers on every render (hover, pan).

  const clusterScatterLayer = useMemo(() => new ScatterplotLayer<ClusterObject>({
    id: "sentinel-clusters",
    data: clusters,
    visible: isClusteringActive,
    getPosition: (d) => d.position,
    getRadius: (d) => 40000 + Math.sqrt(d.count) * 30000,
    getFillColor: (d) => getClusterColor(d.objects),
    getLineColor: (d) => {
      const c = getClusterColor(d.objects);
      return [c[0], c[1], c[2], 255] as EventColor;
    },
    lineWidthMinPixels: 1,
    stroked: true,
    filled: true,
    radiusMinPixels: 6,
    radiusMaxPixels: 60,
    pickable: true,
    onHover: handleHover,
    onClick: handleClick,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [clusters, isClusteringActive, handleHover, handleClick]);

  const scatterLayer = useMemo(() => new ScatterplotLayer<SentinelEvent>({
    id: "sentinel-events",
    data: displayEvents,
    visible: !isClusteringActive,
    getPosition: (d) => [d.lng!, d.lat!],
    getRadius: (d) => getEventRadius(d),
    getFillColor: (d) => getEventColor(d),
    getLineColor: (d) => {
      if (d.is_proprietary) return [255, 255, 255, 255] as EventColor;
      const base = getEventColor(d);
      return [base[0], base[1], base[2], 255] as EventColor;
    },
    getLineWidth: (d) => d.is_proprietary ? 3 : 1,
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 6,
    lineWidthScale: 1,
    stroked: true,
    filled: true,
    radiusMinPixels: 4,
    radiusMaxPixels: 28,
    pickable: true,
    onHover: handleHover,
    onClick: handleClick,
    updateTriggers: {
      getFillColor: [flashEventId],
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [displayEvents, isClusteringActive, flashEventId, handleHover, handleClick]);

  const pulseLayer = useMemo(() => new ScatterplotLayer<SentinelEvent>({
    id: "sentinel-pulse",
    data: displayEvents.filter((e) => (e.severity || 0) >= 7),
    visible: !isClusteringActive,
    getPosition: (d) => [d.lng!, d.lat!],
    getRadius: (d) => getEventRadius(d) * 2.2,
    getFillColor: (d) => {
      const base = getEventColor(d);
      return [base[0], base[1], base[2], 30] as EventColor;
    },
    lineWidthMinPixels: 0,
    stroked: false,
    radiusMinPixels: 8,
    radiusMaxPixels: 50,
    pickable: false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [displayEvents, isClusteringActive]);

  const liveLayer = useMemo(() => new ScatterplotLayer<SentinelEvent>({
    id: "sentinel-live",
    data: validLive,
    getPosition: (d) => [d.lng!, d.lat!],
    getRadius: (d) => getEventRadius(d),
    getFillColor: (d) => getEventColor(d),
    getLineColor: (d) => d.is_proprietary ? ([255, 255, 255, 255] as EventColor) : ([255, 255, 255, 200] as EventColor),
    getLineWidth: (d) => d.is_proprietary ? 4 : 2,
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 8,
    lineWidthScale: 1,
    stroked: true,
    filled: true,
    radiusMinPixels: 5,
    radiusMaxPixels: 32,
    pickable: true,
    onHover: handleHover,
    onClick: handleClick,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [validLive, handleHover, handleClick]);

  const graphLayer = useMemo(() => new LineLayer<GraphEdge>({
    id: "sentinel-graph-edges",
    data: graphEdges,
    visible: showGraph,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getColor: (d) => [245, 158, 11, Math.floor(d.weight * 200)] as EventColor,
    getWidth: 1,
    widthMinPixels: 1,
    pickable: false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [graphEdges, showGraph]);

  const layers = useMemo(
    () => [graphLayer, pulseLayer, clusterScatterLayer, scatterLayer, liveLayer],
    [graphLayer, pulseLayer, clusterScatterLayer, scatterLayer, liveLayer]
  );

  return (
    <div className="relative h-full w-full">
      <DeckGL
        viewState={viewState as any}
        onViewStateChange={handleViewStateChange as any}
        controller={true}
        layers={layers}
        style={{ position: "absolute", inset: "0" }}
      >
        <Map
          mapStyle={CARTO_DARK}
          reuseMaps
          attributionControl={false}
        />
      </DeckGL>

      {/* Lasso Overlay */}
      {isLassoing && (
        <div 
          className="absolute inset-0 z-40 cursor-crosshair"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setLassoStart([x, y]);
            setLassoEnd([x, y]);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (lassoStart) {
              const rect = e.currentTarget.getBoundingClientRect();
              setLassoEnd([e.clientX - rect.left, e.clientY - rect.top]);
            }
          }}
          onPointerUp={(e) => {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            if (lassoStart && lassoEnd) {
              try {
                const vp = new WebMercatorViewport(viewState);
                const minX = Math.min(lassoStart[0], lassoEnd[0]);
                const maxX = Math.max(lassoStart[0], lassoEnd[0]);
                const minY = Math.min(lassoStart[1], lassoEnd[1]);
                const maxY = Math.max(lassoStart[1], lassoEnd[1]);
                
                const nw = vp.unproject([minX, minY]);
                const se = vp.unproject([maxX, maxY]);
                
                // Deck.gl unproject returns [lng, lat]
                const north = nw[1];
                const south = se[1];
                const west = nw[0];
                const east = se[0];
                
                const selected = validEvents.filter(ev => 
                  ev.lat! <= north && ev.lat! >= south &&
                  ev.lng! >= west && ev.lng! <= east
                );
                
                if (selected.length > 0 && onEventsLassoed) {
                  onEventsLassoed(selected);
                }
              } catch (err) {
                console.error("Lasso unproject error:", err);
              }
            }
            setLassoStart(null);
            setLassoEnd(null);
            // We do NOT set isLassoing(false) here so they can keep lassoing as long as Shift is held
          }}
        >
          {lassoStart && lassoEnd && (
            <div 
              className="absolute border-2 border-[#00f0ff] bg-[#00f0ff]/20 pointer-events-none"
              style={{
                left: Math.min(lassoStart[0], lassoEnd[0]),
                top: Math.min(lassoStart[1], lassoEnd[1]),
                width: Math.abs(lassoEnd[0] - lassoStart[0]),
                height: Math.abs(lassoEnd[1] - lassoStart[1])
              }}
            />
          )}
        </div>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-6 left-4 flex flex-col gap-1.5 rounded-sm border border-[#1a2332] bg-[#080c10]/90 px-3 py-2 backdrop-blur">
        {[
          { color: "bg-red-500",    label: "SEVERE SEC" },
          { color: "bg-amber-400",  label: "MAJOR ECO" },
          { color: "bg-blue-500",   label: "CULTURAL" },
          { color: "bg-emerald-500",label: "POSITIVE" },
          { color: "bg-orange-500", label: "THERMAL/INFRA" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${color}`} />
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-400">
              {label}
            </span>
          </div>
        ))}
        <div className="mt-1 border-t border-[#1a2332] pt-1 flex items-center justify-between gap-3">
          <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-600">
            {isClusteringActive ? "LAYER · CLUSTERED" : "LAYER · ALL"}
          </span>
          {showGraph && (
            <span className="font-mono text-[8px] uppercase tracking-widest text-amber-500/70">
              GRAPH ON
            </span>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 max-w-xs rounded-sm border border-[#1a2332] bg-[#0d1117]/95 p-3 text-xs shadow-2xl backdrop-blur"
          style={{ left: tooltip.x + 12, top: tooltip.y - 12 }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                tooltip.event.event_type === "security"
                  ? "bg-red-500/20 text-red-400"
                  : tooltip.event.event_type === "economy" || tooltip.event.event_type === "baseline_metric"
                  ? "bg-amber-500/20 text-amber-400"
                  : tooltip.event.event_type === "positive"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : tooltip.event.event_type === "infrastructure" || tooltip.event.event_type === "environmental"
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {tooltip.event.event_type}
            </span>
            <span className="font-mono text-[9px] text-zinc-500">
              SEV {tooltip.event.severity}/10
            </span>
          </div>
          <p className="mb-1 font-semibold leading-snug text-zinc-100">
            {tooltip.event.headline}
          </p>
          {tooltip.event.ai_analysis && (
            <p className="text-[10px] leading-relaxed text-zinc-400">
              {(tooltip.event.ai_analysis as any).supply_chain_impact ||
               (tooltip.event.ai_analysis as any).delay_estimate}
            </p>
          )}
          <p className="mt-1 font-mono text-[9px] text-zinc-600">
            {new Date(tooltip.event.occurred_at).toLocaleString("en-GB", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
