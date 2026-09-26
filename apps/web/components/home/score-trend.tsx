"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { scoreTrend } from "@/lib/results";

/** Score % across mocks (loaded lazily with Recharts). */
export default function ScoreTrend({ points }: { points: ReturnType<typeof scoreTrend> }) {
  const data = points.map((p, i) => ({ n: i + 1, percent: p.percent, title: p.title }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid strokeOpacity={0.2} />
        <XAxis dataKey="n" tick={{ fontSize: 12, fill: "currentColor" }} allowDecimals={false} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: "currentColor" }} />
        <Tooltip
          formatter={(v) => [`${String(v)}%`, "Score"]}
          labelFormatter={(_, p) => String(p[0]?.payload?.title ?? "")}
        />
        <Line type="monotone" dataKey="percent" stroke="#2b6cb0" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
