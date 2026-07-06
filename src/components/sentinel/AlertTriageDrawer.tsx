import { useState, useMemo, useCallback } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import type { SentinelEvent } from "@/hooks/useSentinelRealtime";

type Props = {
  events: SentinelEvent[];
  onInvestigate: (event: SentinelEvent) => void;
};

const TYPE_COLOR: Record<string, string> = {
  security:         "bg-red-500/20 text-red-400 border-red-500/30",
  economy:          "bg-amber-500/20 text-amber-400 border-amber-500/30",
  baseline_metric:  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  social:           "bg-blue-500/20 text-blue-400 border-blue-500/30",
  positive:         "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  infrastructure:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  environmental:    "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const SEV_COLOR = (s: number) =>
  s >= 9 ? "text-red-400" : s >= 7 ? "text-amber-400" : "text-zinc-400";

export function AlertTriageDrawer({ events, onInvestigate }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Only show severity ≥ 8 events that haven't been dismissed
  const triageEvents = useMemo(
    () => events
      .filter((e) => (e.severity || 0) >= 8 && !dismissedIds.has(e.id))
      .slice(0, 20), // cap at 20 for performance
    [events, dismissedIds]
  );

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const dismissAll = useCallback(() => {
    setDismissedIds((prev) => new Set([...prev, ...triageEvents.map((e) => e.id)]));
  }, [triageEvents]);

  if (triageEvents.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="pointer-events-auto mx-4 mb-4 rounded-sm border border-red-500/30 bg-[#080c10]/95 backdrop-blur shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-500/20 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {/* Pulsing red dot */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-red-400">
              CRITICAL ALERTS
            </span>
            <span className="rounded-sm bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-red-400">
              {triageEvents.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={dismissAll}
              className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              DISMISS ALL
            </button>
            <button
              onClick={() => setIsOpen((v) => !v)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Alert list */}
        {isOpen && (
          <div className="max-h-48 overflow-y-auto divide-y divide-[#1a2332]">
            {triageEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-red-500/5 transition-colors"
              >
                {/* Severity badge */}
                <div className="mt-0.5 flex-shrink-0">
                  <span className={`font-mono text-sm font-bold tabular-nums ${SEV_COLOR(event.severity)}`}>
                    {event.severity}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${TYPE_COLOR[event.event_type] ?? "bg-zinc-700/30 text-zinc-400 border-zinc-700/30"}`}>
                      {event.event_type}
                    </span>
                    <span className="font-mono text-[9px] text-zinc-600">
                      {event.country_code} · {new Date(event.occurred_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-200 leading-snug truncate">
                    {event.headline}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => onInvestigate(event)}
                    title="Investigate in Intel Chat"
                    className="flex items-center gap-1 rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <Search className="h-2.5 w-2.5" />
                    INTEL
                  </button>
                  <button
                    onClick={() => dismiss(event.id)}
                    title="Dismiss alert"
                    className="rounded-sm border border-zinc-700/50 bg-zinc-800/40 p-1 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
