import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LiveWirePanel } from "@/components/sentinel/LiveWirePanel";
import { useSentinelRealtime, type SentinelEvent } from "@/hooks/useSentinelRealtime";

export default function LiveFeed() {
  const [liveEvents, setLiveEvents] = useState<SentinelEvent[]>([]);

  const { data: events = [], refetch } = useQuery({
    queryKey: ["sentinel-all-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sentinel_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SentinelEvent[];
    },
    refetchInterval: 30000,
  });

  useSentinelRealtime({
    onNewEvent: useCallback((e: SentinelEvent) => {
      setLiveEvents((prev) => [e, ...prev].slice(0, 100));
    }, []),
  });

  const allEvents = [...liveEvents, ...events.filter(
    (e) => !liveEvents.find((le) => le.id === e.id)
  )];

  return (
    <div className="flex h-[calc(100vh-44px)] flex-col bg-[#080c10] p-4">
      <div className="mb-4">
        <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
          SENTINEL · FEED
        </p>
        <h1 className="font-mono text-xl font-bold text-amber-400">Live Wire</h1>
        <p className="font-mono text-[10px] text-zinc-500">
          Real-time verified outlet feed · {allEvents.length} events loaded
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <LiveWirePanel events={allEvents} onRefresh={() => refetch()} />
      </div>
    </div>
  );
}
