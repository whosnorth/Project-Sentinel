import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";

type DataPoint = { label: string; count: number };

type Props = {
  data: DataPoint[];
  totalEvents?: number;
  window?: string;
  isLoadingMore?: boolean;
};

export function TimelineBar({ data, totalEvents, window = "24H", isLoadingMore = false }: Props) {
  const total = totalEvents ?? data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-sm border border-[#1a2332] bg-[#0d1117] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            TIMELINE · {window} · 1HR/BIN
          </p>
        </div>
        <span className="font-mono text-[9px] text-zinc-500">
          ALL · {total.toLocaleString()}{isLoadingMore ? "+" : ""} EVENTS
        </span>
      </div>

      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={data} barSize={6} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#52525b", fontSize: 8, fontFamily: "JetBrains Mono, monospace" }}
            tickFormatter={(v, i) => (i === 0 ? `${window} ago` : i === data.length - 1 ? "now" : "")}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0d1117",
              border: "1px solid #1a2332",
              borderRadius: 2,
              fontSize: 10,
              fontFamily: "JetBrains Mono, monospace",
              color: "#f59e0b",
            }}
            cursor={{ fill: "#f59e0b10" }}
          />
          <Bar
            dataKey="count"
            fill="#f59e0b"
            radius={[2, 2, 0, 0]}
            opacity={0.85}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Phase 4 shimmer — shown when background chunks are still loading */}
      {isLoadingMore && (
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-[#1a2332]">
          <div className="h-full animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        </div>
      )}
    </div>
  );
}
