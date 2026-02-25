"use client";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Indian comma-separated format: 437096 → 4,37,096 */
function fmtNumber(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

function colorOf(v: number): "Black" | "Red" | "Yellow" {
  if (v > 0) return "Black";
  if (v < 0) return "Red";
  return "Yellow";
}

const CELL_STYLE: Record<"Black" | "Red" | "Yellow", { bg: string; text: string }> = {
  Black:  { bg: "bg-gray-800",  text: "text-white"     },
  Red:    { bg: "bg-red-100",   text: "text-red-800"   },
  Yellow: { bg: "bg-amber-100", text: "text-amber-800" },
};

const PIE_COLOR: Record<"Black" | "Red" | "Yellow", string> = {
  Black:  "#1f2937",
  Red:    "#ef4444",
  Yellow: "#f59e0b",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ROIPage() {
  const rows = useQuery(api.queries.roi.currentROISummary);

  if (!rows) {
    return <div className="animate-pulse h-96 bg-gray-50 rounded-xl" />;
  }

  // Aggregate counts (skip nulls = no NR data)
  let blackCount = 0, redCount = 0, yellowCount = 0;
  for (const r of rows) {
    if (r.totalNR === null) continue;
    const c = colorOf(r.totalNR);
    if (c === "Black") blackCount++;
    else if (c === "Red") redCount++;
    else yellowCount++;
  }

  const pieData = [
    { name: "Black (Positive)", value: blackCount,  color: PIE_COLOR.Black  },
    { name: "Red (Negative)",   value: redCount,    color: PIE_COLOR.Red    },
    { name: "Yellow (Zero)",    value: yellowCount, color: PIE_COLOR.Yellow },
  ].filter((d) => d.value > 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">ROI Status of CSMs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Current total net revenue per CSM</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Black (Positive)</div>
          <div className="text-2xl font-bold text-gray-900">{blackCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">CSMs with positive NR</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Red (Negative)</div>
          <div className="text-2xl font-bold text-red-600">{redCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">CSMs with negative NR</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Yellow (Zero)</div>
          <div className="text-2xl font-bold text-amber-500">{yellowCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">CSMs at zero NR</div>
        </div>
      </div>

      {/* CSM table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">ROI Status of CSMs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 w-8">#</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">CSM Name</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Location</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Current ROI</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => {
                if (row.totalNR === null) {
                  return (
                    <tr key={row._id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-xs text-gray-400">{i + 1}</td>
                      <td className="py-2 px-3 text-xs font-medium text-gray-700">{row.name}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{row.location}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-xs text-gray-400">NA</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-xs text-gray-400">NA</span>
                      </td>
                    </tr>
                  );
                }

                const code = colorOf(row.totalNR);
                const { bg, text } = CELL_STYLE[code];

                return (
                  <tr key={row._id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 text-xs text-gray-400">{i + 1}</td>
                    <td className="py-2 px-3 text-xs font-medium text-gray-700">{row.name}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{row.location}</td>
                    <td className="py-2 px-3 text-right">
                      <span className="text-xs font-semibold text-gray-800 tabular-nums">
                        {fmtNumber(row.totalNR)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${bg} ${text}`}>
                        {code}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-5 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-800 inline-block" />
            Black — Positive total NR
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
            Red — Negative total NR
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            Yellow — Zero total NR
          </span>
        </div>
      </div>

      {/* Pie chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-0.5">ROI Distribution</h2>
        <p className="text-xs text-gray-400 mb-4">Based on current total NR per CSM</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                dataKey="value"
                label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                labelLine
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`${value} CSMs`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
