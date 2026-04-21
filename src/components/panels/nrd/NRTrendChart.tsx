"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface NRRecord {
  id:         number;
  njId:       number;
  month:      number;
  year:       number;
  nrValue:    number;
  isPositive: boolean;
}

interface Props {
  njId:   number;
  njName: string;
}

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtInr(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000)    return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)       return `${sign}₹${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₹${abs}`;
}

export function NRTrendChart({ njId, njName }: Props) {
  const [records, setRecords] = useState<NRRecord[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/nr?q=byNJ&njId=${njId}`)
      .then(r => r.json())
      .then(data => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [njId]);

  if (loading) {
    return <div className="animate-pulse h-48 bg-gray-50 rounded-xl" />;
  }

  if (!records || records.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-gray-400">
        No NR data available for {njName}
      </div>
    );
  }

  const sorted = [...records].sort((a, b) =>
    a.year !== b.year ? b.year - a.year : b.month - a.month
  );

  const chartData = sorted.map(r => ({
    label:      `${MONTH_ABBR[r.month - 1]} ${String(r.year).slice(2)}`,
    nrValue:    r.nrValue,
    isPositive: r.isPositive,
  }));

  const latest = sorted[0];
  const positiveCount = records.filter(r => r.isPositive).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {latest.isPositive
            ? <TrendingUp size={14} className="text-emerald-500" />
            : <TrendingDown size={14} className="text-red-500" />
          }
          <span className={`text-xs font-semibold ${latest.isPositive ? "text-emerald-600" : "text-red-500"}`}>
            Latest: {latest.isPositive ? "+" : ""}{fmtInr(latest.nrValue)}
          </span>
        </div>
        <span className="text-[10px] text-gray-400">
          {positiveCount}/{records.length} months positive
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmtInr}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1.5} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
            formatter={(v: unknown) => {
              const n = v as number;
              return [fmtInr(n), "NR Value"] as [string, string];
            }}
          />
          <Bar dataKey="nrValue" radius={[4, 4, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.isPositive ? "#10b981" : "#ef4444"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
