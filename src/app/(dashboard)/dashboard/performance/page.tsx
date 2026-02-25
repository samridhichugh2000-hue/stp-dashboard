"use client";

import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { clsx } from "clsx";

function fmtTenure(months: number): string {
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yr} yr ${mo} mo` : `${yr} yr`;
}

type Status = "Positive" | "Negative" | null;

function StatusBadge({ status }: { status: Status }) {
  if (!status) return <span className="text-gray-300 text-xs select-none">—</span>;
  return (
    <span
      className={clsx(
        "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg",
        status === "Positive"
          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/60"
          : "bg-red-100 text-red-700 ring-1 ring-red-200/60"
      )}
    >
      {status}
    </span>
  );
}

export default function PerformancePage() {
  const rows = useQuery(api.queries.performance.njPerformanceStatus);

  const totalPositive = rows?.filter((r) => r.nrStatus === "Positive").length ?? 0;
  const totalNegative = rows?.filter((r) => r.nrStatus === "Negative").length ?? 0;
  const roiPositive   = rows?.filter((r) => r.roiStatus === "Positive").length ?? 0;
  const roiNegative   = rows?.filter((r) => r.roiStatus === "Negative").length ?? 0;

  const statCards = [
    { label: "NR Positive",  value: totalPositive, desc: "CSMs with latest NR positive",  bg: "from-emerald-500 to-teal-600" },
    { label: "NR Negative",  value: totalNegative, desc: "CSMs with latest NR negative",  bg: "from-red-500 to-rose-600" },
    { label: "ROI Positive", value: roiPositive,   desc: "CSMs with overall positive ROI", bg: "from-amber-400 to-yellow-500" },
    { label: "ROI Negative", value: roiNegative,   desc: "CSMs with overall negative ROI", bg: "from-slate-600 to-gray-700" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NJ Performance Status</h1>
        <p className="text-sm text-gray-500 mt-0.5">NR status, ROI status and corporate claims per CSM</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {statCards.map((c) => (
          <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}>
            <div className="text-xs font-medium text-white/70 mb-2">{c.label}</div>
            <div className="text-4xl font-black">
              {rows ? c.value : <span className="text-white/40">—</span>}
            </div>
            <div className="text-xs text-white/60 mt-1">{c.desc}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">CSM Performance Breakdown</h2>
        {rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">CSM Name</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">Tenure</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">NR Status</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">ROI Status</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Corporates Claimed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => (
                  <tr key={row._id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-gray-800 group-hover:text-gray-900">
                      {row.name}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">{fmtTenure(row.tenureMonths)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={row.nrStatus} />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={row.roiStatus} />
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-semibold text-gray-700 tabular-nums">
                      {row.claimedCorporates > 0 ? row.claimedCorporates : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="animate-pulse h-64 bg-gray-50 rounded-xl" />
        )}
      </div>
    </div>
  );
}
