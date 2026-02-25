"use client";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

function fmtINR(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

function fmtAxisINR(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${sign}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)      return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs}`;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { fullName: string; value: number } }[] }) => {
  if (!active || !payload?.length) return null;
  const { fullName, value } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 mb-1">{fullName}</p>
      <p className="text-gray-500">NR from Corporates</p>
      <p className={`text-base font-bold tabular-nums ${value >= 0 ? "text-indigo-600" : "text-red-600"}`}>
        {fmtINR(value)}
      </p>
    </div>
  );
};

export default function RCBPage() {
  const rows = useQuery(api.queries.rcb.allCorpSummary);

  if (!rows) return <div className="animate-pulse h-96 bg-white/60 rounded-2xl" />;

  const totalClaimed = rows.reduce((s, r) => s + (r.claimedCorporates ?? 0), 0);
  const totalNR = rows.reduce((s, r) => s + (r.nrFromCorporates ?? 0), 0);
  const csmsWithData = rows.filter(r => r.claimedCorporates != null || r.nrFromCorporates != null).length;

  // Chart: only CSMs with nrFromCorporates data, sorted desc (already sorted by query)
  const chartData = rows
    .filter(r => r.nrFromCorporates != null)
    .map(r => ({
      name: r.name,
      // Short label for Y-axis
      label: r.name.split(" ").map((w, i) => i === 0 ? w : w[0] + ".").join(" "),
      value: r.nrFromCorporates!,
    }));

  const chartHeight = Math.max(260, chartData.length * 34 + 60);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">RCB — Corporate Performance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Claimed Corporates &amp; NR from Corporates per CSM</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 stagger">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">CSMs with Corporate Data</div>
          <div className="text-4xl font-black">{csmsWithData}</div>
          <div className="text-xs text-white/60 mt-1">Active CSMs</div>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Total Claimed Corporates</div>
          <div className="text-4xl font-black">{totalClaimed}</div>
          <div className="text-xs text-white/60 mt-1">Across all CSMs</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Total NR from Corporates</div>
          <div className="text-xl font-black tabular-nums leading-tight mt-1">{fmtINR(totalNR)}</div>
          <div className="text-xs text-white/60 mt-1">Combined corporate NR</div>
        </div>
      </div>

      {/* Horizontal bar chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-0.5">NR from Corporates — by CSM</h2>
          <p className="text-xs text-gray-400 mb-4">Sorted by corporate NR (highest first) · Hover for exact values</p>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 100, bottom: 4, left: 140 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={fmtAxisINR}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#374151" }}
                  width={136}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f0f4ff" }} />
                <ReferenceLine x={0} stroke="#e5e7eb" strokeWidth={1.5} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22} label={{
                  position: "right",
                  formatter: (v: number) => fmtAxisINR(v),
                  fontSize: 10,
                  fill: "#6b7280",
                }}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.value >= 0 ? "#6366f1" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">CSM Corporate Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 w-8">#</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">CSM Name</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">Location</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400">Claimed Corporates</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400">NR from Corporates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={row._id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                  <td className="py-2.5 px-3 text-xs font-semibold text-gray-800 group-hover:text-gray-900">
                    {row.name}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-400">{row.location}</td>
                  <td className="py-2.5 px-3 text-right text-xs font-bold text-gray-800 tabular-nums">
                    {row.claimedCorporates != null
                      ? row.claimedCorporates
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm font-bold tabular-nums text-gray-900">
                    {row.nrFromCorporates != null
                      ? fmtINR(row.nrFromCorporates)
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
