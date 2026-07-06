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
// that are broadcast in the full Realtime payload but not needed in the UI
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

const MAX_RETRIES = 6;
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

    function connect() {
      if (destroyed) return;

      channel = supabase
        .channel("sentinel-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sentinel_events" },
          (payload) => {
            const safe = stripToSafeEvent(payload.new as Record<string, unknown>);
            onEventRef.current?.(safe);
            onNewEventRef.current?.(safe); // backward compat
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
            retries = 0;
            onStatusRef.current?.("connected");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            onStatusRef.current?.("reconnecting");

            if (retries < MAX_RETRIES) {
              const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retries++), MAX_DELAY_MS);
              console.warn(`[Sentinel Realtime] ${status} — retry ${retries}/${MAX_RETRIES} in ${delay}ms`, err);
              retryTimer = setTimeout(() => {
                if (channel) supabase.removeChannel(channel);
                connect();
              }, delay);
            } else {
              console.error("[Sentinel Realtime] Max retries exceeded — feed offline");
              onStatusRef.current?.("disconnected");
            }
          } else if (status === "CLOSED") {
            if (!destroyed) onStatusRef.current?.("disconnected");
          }
        });
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []); // stable — all callbacks are accessed via refs
}
