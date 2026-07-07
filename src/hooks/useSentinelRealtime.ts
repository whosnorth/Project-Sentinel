import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SentinelEvent = {
  id: string;
  headline: string;
  country_code: string;
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  event_type: "security" | "economy" | "social" | "positive" | "infrastructure" | "environmental" | "baseline_metric";
  severity: number;
  ai_analysis: Record<string, unknown> | null;
  occurred_at: string;
  full_text?: string | null;
  is_proprietary?: boolean;
  source_url?: string | null;
};

export type SentinelRiskScore = {
  country_code: string;
  score: number;
  security_score: number | null;
  economy_score: number | null;
  social_score: number | null;
  event_count: number;
  computed_at: string;
};

// Fields that are safe to send to clients — strips large/raw DB columns
const SAFE_EVENT_FIELDS: (keyof SentinelEvent)[] = [
  "id", "headline", "country_code", "region", "city",
  "lat", "lng", "event_type", "severity", "ai_analysis", "occurred_at",
  "full_text", "source_url"
];

type Callbacks = {
  onEvent?: (event: SentinelEvent) => void;
  /** @deprecated Use onEvent. Kept for backward compatibility. */
  onNewEvent?: (event: SentinelEvent) => void;
  onRiskUpdate?: (score: SentinelRiskScore) => void;
  onStatusChange?: (status: "connected" | "reconnecting" | "disconnected") => void;
};

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export function useSentinelRealtime({
  onEvent,
  onNewEvent,
  onRiskUpdate,
  onStatusChange,
}: Callbacks = {}) {
  const onEventRef       = useRef(onEvent);
  const onNewEventRef    = useRef(onNewEvent);
  const onRiskUpdateRef  = useRef(onRiskUpdate);
  const onStatusRef      = useRef(onStatusChange);

  // Keep refs current without triggering effect re-runs
  useEffect(() => {
    onEventRef.current      = onEvent;
    onNewEventRef.current   = onNewEvent;
    onRiskUpdateRef.current = onRiskUpdate;
    onStatusRef.current     = onStatusChange;
  });

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function stripToSafeEvent(raw: Record<string, unknown>): SentinelEvent {
      const safe: Partial<SentinelEvent> = {};
      for (const key of SAFE_EVENT_FIELDS) {
        (safe as any)[key] = raw[key] ?? null;
      }
      return safe as SentinelEvent;
    }

    function scheduleReconnect() {
      if (destroyed) return;
      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retries), MAX_DELAY_MS);
      console.warn(`[Sentinel Realtime] Retrying connection in ${Math.round(delay / 1000)}s (attempt ${retries + 1})`);
      retries++;
      retryTimer = setTimeout(() => {
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        connect();
      }, delay);
    }

    function connect() {
      if (destroyed) return;

      // Use a unique channel name each time to avoid stale-channel collisions on Supabase's side
      channel = supabase
        .channel(`sentinel-live-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sentinel_events" },
          (payload) => {
            const safe = stripToSafeEvent(payload.new as Record<string, unknown>);
            onEventRef.current?.(safe);
            onNewEventRef.current?.(safe);
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sentinel_risk_scores" },
          (payload) => {
            onRiskUpdateRef.current?.(payload.new as SentinelRiskScore);
          }
        )
        .subscribe((status, err) => {
          if (destroyed) return;

          if (status === "SUBSCRIBED") {
            retries = 0; // reset backoff counter on success
            console.log("[Sentinel Realtime] Connected ✓");
            onStatusRef.current?.("connected");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(`[Sentinel Realtime] ${status}`, err);
            onStatusRef.current?.("reconnecting");
            scheduleReconnect(); // never give up — always retry
          } else if (status === "CLOSED") {
            if (!destroyed) {
              onStatusRef.current?.("reconnecting");
              scheduleReconnect(); // re-open on unexpected close too
            }
          }
        });
    }

    connect();

    // Reconnect when tab becomes visible again (covers browser tab sleep / network changes)
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !destroyed) {
        console.log("[Sentinel Realtime] Tab visible — ensuring connection");
        if (retryTimer) clearTimeout(retryTimer);
        if (channel) supabase.removeChannel(channel);
        retries = 0;
        connect();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []); // stable — all callbacks are accessed via refs
}
