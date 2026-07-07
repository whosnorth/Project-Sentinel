import { useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import type { SentinelEvent } from "@/hooks/useSentinelRealtime";

type Props = {
  events: SentinelEvent[];
  onRefresh?: () => void;
  onEventSelect?: (event: SentinelEvent) => void;
};

const TYPE_COLORS: Record<string, string> = {
  security: "bg-red-500",
  economy:  "bg-amber-400",
  social:   "bg-blue-500",
  positive: "bg-emerald-500",
};

const TYPE_LABEL: Record<string, string> = {
  security: "SEC",
  economy:  "ECO",
  social:   "SOC",
  positive: "POS",
};

export function LiveWirePanel({ events, onRefresh, onEventSelect }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "nigeria" | "global">("all");

  const filtered = events.filter((e) => {
    const matchesQuery =
      !query ||
      e.headline.toLowerCase().includes(query.toLowerCase()) ||
      (e.city || "").toLowerCase().includes(query.toLowerCase()) ||
      (e.country_code || "").toLowerCase().includes(query.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "nigeria" && e.country_code === "NG") ||
      (filter === "global" && e.country_code !== "NG");

    return matchesQuery && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full rounded-sm border border-[#1a2332] bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1a2332] px-4 py-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            LIVE WIRE
          </p>
          <p className="font-mono text-xs font-semibold text-zinc-300">
            Verified outlet feed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="font-mono text-[9px] text-emerald-400 uppercase tracking-widest">
            LIVE
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 border-b border-[#1a2332] px-4 py-2">
        {(["all", "nigeria", "global"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-sm px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
              filter === f
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 rounded-sm px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors border border-[#1a2332] hover:border-zinc-600"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            REFRESH
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-[#1a2332] px-4 py-2">
        <div className="flex items-center gap-2 rounded-sm border border-[#1a2332] bg-[#080c10] px-3 py-1.5">
          <Search className="h-3 w-3 text-zinc-600" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headlines, locations, sources…"
            className="w-full bg-transparent font-mono text-[10px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
        <p className="mt-1 font-mono text-[9px] text-zinc-600">
          WINDOW: LAST 24H &nbsp;·&nbsp; {filtered.length} EVENTS
        </p>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="font-mono text-[10px] text-zinc-600">NO EVENTS MATCH FILTER</p>
          </div>
        ) : (
          filtered.map((event) => {
            const elapsed = Math.round(
              (Date.now() - new Date(event.occurred_at).getTime()) / 60000
            );
            return (
              <div
                key={event.id}
                onClick={() => onEventSelect?.(event)}
                className="border-b border-[#1a2332] px-4 py-3 hover:bg-[#080c10]/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[9px] text-zinc-500">
                    {elapsed < 1 ? "0M AGO" : `${elapsed}M AGO`}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      TYPE_COLORS[event.event_type] || "bg-zinc-500"
                    }`}
                  />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-400">
                    {event.city || event.region || event.country_code}
                  </span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                    {TYPE_LABEL[event.event_type] || "OTH"}
                  </span>
                </div>
                <p className="text-[11px] font-medium leading-snug text-zinc-200">
                  {event.headline}
                </p>
                {event.ai_analysis && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-sm border border-zinc-700/50 bg-zinc-800/40 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
                      AI VERIFIED
                    </span>
                    <span className="font-mono text-[9px] text-zinc-600">
                      SEV {event.severity}/10
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
