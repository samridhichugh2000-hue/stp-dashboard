"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface TrendLineChartProps {
  data: Array<{ date: string; score: number }>;
}

export function TrendLineChart({ data }: TrendLineChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: format(new Date(d.date), "dd MMM"),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          formatter={(v) => [`${v ?? "?"}/100`, "Score"]}
        />
        <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Target 50", position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }} />
        <ReferenceLine y={70} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Good 70", position: "insideTopRight", fontSize: 10, fill: "#10b981" }} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3, fill: "#3b82f6" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
