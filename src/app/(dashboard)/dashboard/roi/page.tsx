"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Sector } from "recharts";

function fmtNumber(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

function fmtTenure(months: number): string {
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yr} yr ${mo} mo` : `${yr} yr`;
}

function colorOf(v: number): "Positive" | "Negative" | "Zero" {
  if (v > 0) return "Positive";
  if (v < 0) return "Negative";
  return "Zero";
}

const NUM_COLOR = {
  Positive: "text-amber-500",
  Negative: "text-red-600",
  Zero:     "text-gray-900",
};

const PIE_COLORS = {
  Positive: "#f59e0b",
  Negative: "#ef4444",
  Zero:     "#374151",
};

const CARD_CONFIG = {
  Positive: { bg: "from-amber-400 to-yellow-500",  label: "Positive NR", desc: "CSMs with positive NR" },
  Negative: { bg: "from-red-500 to-rose-600",       label: "Negative NR", desc: "CSMs with negative NR" },
  Zero:     { bg: "from-slate-600 to-gray-700",     label: "Zero NR",     desc: "CSMs at zero NR" },
};

const renderActiveShape = (props: Record<string, number & string>) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 18} textAnchor="middle" fill="#374151" fontSize={13} fontWeight="600">
        {(payload as unknown as {name:string}).name}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#111827" fontSize={26} fontWeight="800">
        {value as unknown as number}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#9ca3af" fontSize={12}>
        {`${((percent as unknown as number) * 100).toFixed(1)}% of CSMs`}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={(outerRadius as unknown as number) + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={(outerRadius as unknown as number) + 10}
        outerRadius={(outerRadius as unknown as number) + 14}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function ROIPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const rows = useQuery(api.queries.roi.currentROISummary);

  if (!rows) return <div className="animate-pulse h-96 bg-white/60 rounded-2xl" />;

  let positiveCount = 0, negativeCount = 0, zeroCount = 0;
  for (const r of rows) {
    if (r.totalNR === null) continue;
    const c = colorOf(r.totalNR);
    if (c === "Positive") positiveCount++;
    else if (c === "Negative") negativeCount++;
    else zeroCount++;
  }

  const pieData = [
    { name: "Positive", value: positiveCount, color: PIE_COLORS.Positive },
    { name: "Negative", value: negativeCount, color: PIE_COLORS.Negative },
    { name: "Zero",     value: zeroCount,     color: PIE_COLORS.Zero     },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ROI Status of CSMs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Current total net revenue per CSM</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 stagger">
        {(["Positive", "Negative", "Zero"] as const).map(k => {
          const count = k === "Positive" ? positiveCount : k === "Negative" ? negativeCount : zeroCount;
          const cfg = CARD_CONFIG[k];
          return (
            <div key={k} className={`bg-gradient-to-br ${cfg.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}>
              <div className="text-xs font-medium text-white/70 mb-2">{cfg.label}</div>
              <div className="text-4xl font-black">{count}</div>
              <div className="text-xs text-white/60 mt-1">{cfg.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">CSM ROI Breakdown</h2>
          <div className="flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Negative</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-700 inline-block" />Zero</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 w-8">#</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400">CSM Name</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400">Tenure</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Current ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => {
                if (row.totalNR === null) {
                  return (
                    <tr key={row._id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                      <td className="py-2.5 px-3 text-xs font-medium text-gray-600">{row.name}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-400">{fmtTenure(row.tenureMonths)}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-gray-300">—</td>
                    </tr>
                  );
                }
                const code = colorOf(row.totalNR);
                return (
                  <tr key={row._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-gray-800 group-hover:text-gray-900">{row.name}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">{fmtTenure(row.tenureMonths)}</td>
                    <td className={`py-2.5 px-3 text-right text-sm font-bold tabular-nums ${NUM_COLOR[code]}`}>
                      {fmtNumber(row.totalNR)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pie chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-0.5">ROI Distribution</h2>
        <p className="text-xs text-gray-400 mb-2">Hover over a segment to explore</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIdx}
                activeShape={renderActiveShape as never}
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={72}
                outerRadius={108}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIdx(index)}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="white" strokeWidth={3} />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={10}
                formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
