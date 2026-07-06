import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DataPoint = { label: string; value: number };

type Props = {
  data: DataPoint[];
  title?: string;
  subtitle?: string;
};

export function TrendChart({ data, title = "7-DAY TREND", subtitle = "CSI · weekly arc" }: Props) {
  return (
    <div className="rounded-sm border border-[#1a2332] bg-[#0d1117] p-4">
      <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">{title}</p>
      <p className="mb-3 font-mono text-xs font-semibold text-zinc-300">{subtitle}</p>

      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="sentinelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: "#52525b", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis domain={[0, 100]} tick={false} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "#0d1117",
              border: "1px solid #1a2332",
              borderRadius: 2,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              color: "#f59e0b",
            }}
            itemStyle={{ color: "#f59e0b" }}
            cursor={{ stroke: "#f59e0b", strokeWidth: 0.5, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#f59e0b"
            strokeWidth={1.5}
            fill="url(#sentinelGrad)"
            dot={false}
            activeDot={{ r: 3, fill: "#f59e0b", stroke: "#080c10", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
