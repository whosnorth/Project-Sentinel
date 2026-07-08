import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SentinelEvent } from "@/hooks/useSentinelRealtime";
import type { LocationSelection } from "@/components/sentinel/LocationTypes";
import type { ViewportBounds } from "@/components/sentinel/GlobalRiskMap";

const CHUNK_DAYS = 30;           // Days per background fetch chunk
const CHUNK_DELAY_MS = 800;      // Delay between auto-fetching chunks
const EVENT_CEILING = 10000;     // Hard stop — force clustering above this
const LONG_WINDOWS = new Set(["30D", "90D", "1Y"]);

// Short windows / non-global views use a single-page query (no chunking needed)
const WINDOW_HOURS: Record<string, number> = {
  "6H": 6, "24H": 24, "7D": 168, "30D": 720, "90D": 2160, "1Y": 8760,
};

type Options = {
  window: string;
  category: string;
  location: LocationSelection;
  currentZoom: number;
  viewportBounds: ViewportBounds | null;
  bboxZoomThreshold: number;
  dataSource?: "ALL" | "OSINT" | "BESPOKE";
};

type Result = {
  events: SentinelEvent[];
  totalLoaded: number;
  isLoadingMore: boolean;
  cappedAt10k: boolean;
  error: string | null;
};

async function fetchChunk(
  since: string,
  until: string,
  category: string,
  location: LocationSelection,
  currentZoom: number,
  viewportBounds: ViewportBounds | null,
  bboxZoomThreshold: number,
  limit: number,
  dataSource?: "ALL" | "OSINT" | "BESPOKE"
): Promise<SentinelEvent[]> {
  let q = supabase
    .from("sentinel_events")
    .select("id, event_type, country_code, lat, lng, severity, headline, occurred_at, source_url, full_text")
    .gte("occurred_at", since)
    .lt("occurred_at", until)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  // Bbox culling when zoomed in
  if (currentZoom >= bboxZoomThreshold && viewportBounds) {
    q = q
      .gte("lat", viewportBounds.south)
      .lte("lat", viewportBounds.north)
      .gte("lng", viewportBounds.west)
      .lte("lng", viewportBounds.east);
  }

  if (location.type === "country") {
    q = q.eq("country_code", location.code);
  } else if (location.type === "region") {
    q = q.in("country_code", location.countries.map((c) => c.code));
  }

  if (category === "SECURITY") q = q.eq("event_type", "security");
  else if (category === "ECONOMY") q = q.in("event_type", ["economy", "baseline_metric"]);
  else if (category === "CULTURE") q = q.eq("event_type", "social");
  else if (category === "INFRASTRUCTURE") q = q.in("event_type", ["infrastructure", "environmental"]);
  else if (category === "POSITIVE") q = q.eq("event_type", "positive");

  if (dataSource === "OSINT") q = (q as any).eq("is_proprietary", false);
  else if (dataSource === "BESPOKE") q = (q as any).eq("is_proprietary", true);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SentinelEvent[];
}

/**
 * useSentinelProgressiveLoad
 *
 * For short windows (6H, 24H, 7D) or non-global views: behaves exactly like a
 * single useQuery — one fetch, no chunking.
 *
 * For long windows (30D, 90D, 1Y) in global view: automatically streams events
 * in 30-day chunks in the background. The most recent chunk loads first, then
 * subsequent chunks fire automatically after a brief settling delay. No user
 * interaction required. Loading stops when either the full window is covered or
 * the 10k ceiling is hit.
 */
export function useSentinelProgressiveLoad(opts: Options): Result {
  const { window, category, location, currentZoom, viewportBounds, bboxZoomThreshold, dataSource = "ALL" } = opts;

  const [events, setEvents] = useState<SentinelEvent[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cappedAt10k, setCappedAt10k] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks which chunk offset (in days from now) we have loaded so far
  const chunkOffsetRef = useRef(0);
  const abortRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLongWindow = LONG_WINDOWS.has(window) && location.type === "global";
  const totalWindowHours = WINDOW_HOURS[window] ?? 24;
  const totalWindowDays = totalWindowHours / 24;

  // Reset everything when key params change
  const resetKey = `${window}|${category}|${JSON.stringify(location)}`;
  const prevResetKey = useRef(resetKey);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const loadNextChunk = useCallback(
    async (
      currentOffset: number,
      accumulated: SentinelEvent[],
      signal: { aborted: boolean }
    ) => {
      if (signal.aborted) return;
      if (accumulated.length >= EVENT_CEILING) {
        setCappedAt10k(true);
        setIsLoadingMore(false);
        return;
      }

      const until = new Date(Date.now() - currentOffset * 24 * 3600000).toISOString();
      const since = new Date(
        Date.now() - (currentOffset + CHUNK_DAYS) * 24 * 3600000
      ).toISOString();
      const windowSince = new Date(Date.now() - totalWindowDays * 24 * 3600000).toISOString();

      // Clamp since to window start
      const effectiveSince = since < windowSince ? windowSince : since;

      const remaining = EVENT_CEILING - accumulated.length;
      const chunkData = await fetchChunk(
        effectiveSince,
        until,
        category,
        location,
        currentZoom,
        viewportBounds,
        bboxZoomThreshold,
        Math.min(2000, remaining),
        dataSource
      );

      if (signal.aborted) return;

      // Deduplicate against already-loaded events
      const existingIds = new Set(accumulated.map((e) => e.id));
      const newEvents = chunkData.filter((e) => !existingIds.has(e.id));
      const merged = [...accumulated, ...newEvents];

      setEvents(merged);
      chunkOffsetRef.current = currentOffset + CHUNK_DAYS;

      const nextOffset = currentOffset + CHUNK_DAYS;
      const isWindowFullyCovered = nextOffset >= totalWindowDays;
      const isAtCeiling = merged.length >= EVENT_CEILING;

      if (isAtCeiling) {
        setCappedAt10k(true);
        setIsLoadingMore(false);
        return;
      }

      if (isWindowFullyCovered || newEvents.length === 0) {
        // All chunks loaded
        setIsLoadingMore(false);
        return;
      }

      // Schedule next chunk automatically
      timerRef.current = setTimeout(() => {
        loadNextChunk(nextOffset, merged, signal);
      }, CHUNK_DELAY_MS);
    },
    [category, location, currentZoom, viewportBounds, bboxZoomThreshold, totalWindowDays, dataSource]
  );

  useEffect(() => {
    const signal = { aborted: false };
    abortRef.current = false;
    clearTimer();

    setEvents([]);
    setCappedAt10k(false);
    setError(null);
    chunkOffsetRef.current = 0;

    if (isLongWindow) {
      // Progressive mode: start with chunk 0, auto-continue
      setIsLoadingMore(true);
      loadNextChunk(0, [], signal);
    } else {
      // Single-page mode: fetch full window in one shot
      setIsLoadingMore(true);
      const hoursBack = totalWindowHours;
      const since = new Date(Date.now() - hoursBack * 3600000).toISOString();
      const until = new Date().toISOString();

      fetchChunk(
        since,
        until,
        category,
        location,
        currentZoom,
        viewportBounds,
        bboxZoomThreshold,
        2000,
        dataSource
      )
        .then((data) => {
          if (!signal.aborted) {
            setEvents(data);
            setIsLoadingMore(false);
          }
        })
        .catch((err) => {
          if (!signal.aborted) {
            setIsLoadingMore(false);
            setError(err?.message ?? "Failed to load events");
          }
        });
    }

    return () => {
      signal.aborted = true;
      clearTimer();
    };
  // Re-run whenever key parameters change (window, category, location, viewport)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window, category, JSON.stringify(location), currentZoom >= bboxZoomThreshold ? JSON.stringify(viewportBounds) : null]);

  return {
    events,
    totalLoaded: events.length,
    isLoadingMore,
    cappedAt10k,
    error,
  };
}
