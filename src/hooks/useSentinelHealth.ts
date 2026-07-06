import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SentinelHealthStatus = "healthy" | "degraded" | "stale" | "offline";

export type SentinelHealth = {
  status: SentinelHealthStatus;
  realtimeStatus: "connected" | "reconnecting" | "disconnected";
  lastIngestAt: Date | null;
  minutesSinceIngest: number | null;
};

const STALE_THRESHOLD_MIN = 10;   // amber: > 10 min since last ingest
const OFFLINE_THRESHOLD_MIN = 30; // red: > 30 min since last ingest

/**
 * useSentinelHealth
 *
 * Checks:
 * 1. Realtime channel status (passed in from useSentinelRealtime's onStatusChange)
 * 2. Most recent ingested_at timestamp from sentinel_events
 *
 * Returns a composite status:
 * - "healthy"  → Realtime connected + ingested within 10 min
 * - "degraded" → ingested between 10–30 min ago
 * - "stale"    → ingested > 30 min ago
 * - "offline"  → Realtime disconnected
 */
export function useSentinelHealth(
  realtimeStatus: "connected" | "reconnecting" | "disconnected"
): SentinelHealth {
  const [lastIngestAt, setLastIngestAt] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for last ingest timestamp every 60s
  useEffect(() => {
    async function checkIngest() {
      try {
        const { data } = await supabase
          .from("sentinel_events")
          .select("ingested_at")
          .order("ingested_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.ingested_at) {
          setLastIngestAt(new Date(data.ingested_at));
        }
      } catch {
        // Silently ignore — health check should never throw
      }
    }

    checkIngest(); // immediate on mount
    intervalRef.current = setInterval(checkIngest, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const minutesSinceIngest = lastIngestAt
    ? Math.floor((Date.now() - lastIngestAt.getTime()) / 60_000)
    : null;

  let status: SentinelHealthStatus = "healthy";

  if (realtimeStatus === "disconnected") {
    status = "offline";
  } else if (minutesSinceIngest === null || minutesSinceIngest > OFFLINE_THRESHOLD_MIN) {
    status = "stale";
  } else if (minutesSinceIngest > STALE_THRESHOLD_MIN) {
    status = "degraded";
  }

  return { status, realtimeStatus, lastIngestAt, minutesSinceIngest };
}
