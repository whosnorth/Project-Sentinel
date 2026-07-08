import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LiveWirePanel } from "@/components/sentinel/LiveWirePanel";
import { useSentinelRealtime, type SentinelEvent } from "@/hooks/useSentinelRealtime";

export default function LiveFeed() {
  const [liveEvents, setLiveEvents] = useState<SentinelEvent[]>([]);
  const [dataSource, setDataSource] = useState<"ALL" | "OSINT" | "BESPOKE">("ALL");

  const { data: events = [], refetch } = useQuery({
    queryKey: ["sentinel-all-events", dataSource],
    queryFn: async () => {
      let q = supabase
        .from("sentinel_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(500);

      if (dataSource === "OSINT") q = (q as any).eq("is_proprietary", false);
      else if (dataSource === "BESPOKE") q = (q as any).eq("is_proprietary", true);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SentinelEvent[];
    },
    refetchInterval: 30000,
  });

  useSentinelRealtime({
    onNewEvent: useCallback((e: SentinelEvent) => {
      if (dataSource === "OSINT" && e.is_proprietary) return;
      if (dataSource === "BESPOKE" && !e.is_proprietary) return;
      
      setLiveEvents((prev) => [e, ...prev].slice(0, 100));
    }, [dataSource]),
  });

  const allEvents = [...liveEvents, ...events.filter(
    (e) => !liveEvents.find((le) => le.id === e.id)
  )];

  return (
    <div className="flex h-[calc(100vh-44px)] flex-col bg-[#080c10] p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            SENTINEL · FEED
          </p>
          <h1 className="font-mono text-xl font-bold text-amber-400">Live Wire</h1>
          <p className="font-mono text-[10px] text-zinc-500">
            Real-time verified outlet feed · {allEvents.length} events loaded
          </p>
        </div>
        <select
          value={dataSource}
          onChange={(e) => setDataSource(e.target.value as any)}
          className="bg-[#0d1117] border border-[#1a2332] rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400 focus:outline-none focus:border-amber-500"
        >
          <option value="ALL">ALL DATA</option>
          <option value="OSINT">OSINT ONLY</option>
          <option value="BESPOKE">BESPOKE ONLY</option>
        </select>
      </div>
      <div className="flex-1 min-h-0">
        <LiveWirePanel events={allEvents} onRefresh={() => refetch()} />
      </div>
    </div>
  );
}
