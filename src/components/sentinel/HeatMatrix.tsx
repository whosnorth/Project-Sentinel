import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Cell = { value: number };
type Row = { region: string; sec: Cell; gov: Cell; eco: Cell; soc: Cell; conf: Cell };

const EVENT_BUCKET_MAP: Record<string, string[]> = {
  security:       ["sec", "conf"],
  conflict:       ["sec", "conf"],
  terrorism:      ["sec", "conf"],
  violence:       ["sec"],
  infrastructure: ["gov", "eco"],
  environmental:  ["soc"],
  economy:        ["eco"],
  trade:          ["eco"],
  sanctions:      ["eco", "gov"],
  government:     ["gov"],
  protest:        ["gov", "soc"],
  coup:           ["gov", "conf"],
  corruption:     ["gov"],
  social:         ["soc"],
  displacement:   ["soc"],
  humanitarian:   ["soc"],
  human_rights:   ["gov", "soc"],
  military:       ["conf", "sec"],
  border:         ["conf"],
  baseline_metric:["eco"],
  positive:       [],
};

function cellClass(v: number): string {
  if (v >= 70) return "bg-emerald-900/80 text-emerald-300 border-emerald-800/50";
  if (v >= 50) return "bg-amber-900/60 text-amber-300 border-amber-800/40";
  if (v >= 35) return "bg-zinc-800/60 text-zinc-300 border-zinc-700/40";
  return "bg-red-900/60 text-red-300 border-red-800/40";
}

// Simple geographic region labelling using lat/lng
function getRegionLabel(lat: number, lng: number): string {
  // Divide into cardinal regions using median
  if (lat > 0) {
    if (lng > 0) return lat > 30 ? "North-East" : "Central-East";
    return lat > 30 ? "North-West" : "Central-West";
  } else {
    if (lng > 0) return "South-East";
    return "South-West";
  }
}

// Grid-cell region assignment (creates up to 6 buckets based on quantiles)
function assignRegions(events: any[]): Record<string, any[]> {
  const withCoords = events.filter((e) => e.lat != null && e.lng != null);
  if (withCoords.length === 0) return {};

  const lats = withCoords.map((e) => e.lat).sort((a, b) => a - b);
  const lngs = withCoords.map((e) => e.lng).sort((a, b) => a - b);
  const latMid = lats[Math.floor(lats.length / 2)];
  const lngMid = lngs[Math.floor(lngs.length / 2)];

  const regions: Record<string, any[]> = {};
  for (const e of withCoords) {
    const latLabel = e.lat >= latMid ? "North" : "South";
    const lngLabel = e.lng < lngMid ? "West" : e.lng > lngMid + (lngs[lngs.length - 1] - lngs[0]) / 3 ? "East" : "Central";
    const key = `${latLabel}-${lngLabel}`;
    if (!regions[key]) regions[key] = [];
    regions[key].push(e);
  }
  return regions;
}

function computePillarScore(events: any[], pillar: string): number {
  if (events.length === 0) return 50;
  const now = Date.now();
  const LAMBDA = 0.05;
  let raw = 0; let count = 0;
  for (const e of events) {
    const buckets = EVENT_BUCKET_MAP[e.event_type as string] ?? [];
    if (!buckets.includes(pillar)) continue;
    const deltaT = (now - new Date(e.occurred_at).getTime()) / (1000 * 3600 * 24);
    const contribution = (e.severity ?? 5) * Math.exp(-LAMBDA * deltaT);
    raw += contribution; count++;
  }
  if (count === 0) return 80; // No events of this type = relatively stable for this pillar
  const risk = Math.min(100, (raw / count) * 10);
  return Math.round(Math.max(0, 100 - risk));
}

type Props = { countryCode?: string; rows?: Row[] };

export function HeatMatrix({ countryCode, rows }: Props) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["heatmatrix-events", countryCode],
    enabled: !!countryCode && !rows,
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sentinel_events")
        .select("id, event_type, severity, occurred_at, lat, lng")
        .eq("country_code", (countryCode ?? "").toUpperCase())
        .gte("occurred_at", thirtyDaysAgo)
        .not("severity", "is", null)
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const dynamicRows: Row[] = useMemo(() => {
    if (rows) return rows; // static override
    if (!events || events.length < 5) return [];

    const regionBuckets = assignRegions(events);
    const regionKeys = Object.keys(regionBuckets);
    if (regionKeys.length === 0) return [];

    return regionKeys.map((region) => {
      const re = regionBuckets[region];
      return {
        region,
        sec:  { value: computePillarScore(re, "sec") },
        gov:  { value: computePillarScore(re, "gov") },
        eco:  { value: computePillarScore(re, "eco") },
        soc:  { value: computePillarScore(re, "soc") },
        conf: { value: computePillarScore(re, "conf") },
      };
    }).sort((a, b) => {
      // Sort most at-risk first
      const avgA = (a.sec.value + a.gov.value + a.eco.value + a.soc.value + a.conf.value) / 5;
      const avgB = (b.sec.value + b.gov.value + b.eco.value + b.soc.value + b.conf.value) / 5;
      return avgA - avgB;
    });
  }, [events, rows]);

  const displayRows = rows ?? dynamicRows;

  return (
    <div className="rounded-sm border border-[#1a2332] bg-[#0d1117] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            RISK MATRIX
          </p>
          <p className="font-mono text-xs font-semibold text-zinc-300">
            Region × Pillar heat
          </p>
        </div>
        <span className="font-mono text-[9px] text-zinc-500">0–100</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 rounded-sm bg-[#1a2332] animate-pulse" />
          ))}
        </div>
      ) : displayRows.length === 0 ? (
        <p className="font-mono text-[9px] text-zinc-600 text-center py-4">
          Insufficient regional data for {countryCode ?? "this country"}
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="pb-2 text-left font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                REGION
              </th>
              {["SEC", "GOV", "ECO", "SOC", "CONF"].map((h) => (
                <th key={h} className="pb-2 text-center font-mono text-[9px] uppercase tracking-widest text-zinc-600 w-10">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr key={row.region}>
                <td className="py-1 pr-3 font-mono text-[9px] text-zinc-400 whitespace-nowrap">
                  {row.region}
                </td>
                {[row.sec.value, row.gov.value, row.eco.value, row.soc.value, row.conf.value].map((v, i) => (
                  <td key={i} className="py-0.5 px-0.5 text-center">
                    <span className={`inline-block w-full rounded-sm border px-0.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${cellClass(v)}`}>
                      {v}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-2 font-mono text-[8px] text-zinc-700">
        SEC=Security · GOV=Governance · ECO=Economy · SOC=Social · CONF=Conflict · 100=Stable
      </p>
    </div>
  );
}
