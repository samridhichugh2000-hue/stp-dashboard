"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { NJFilter } from "@/components/shared/NJFilter";
import { ExportButton } from "@/components/shared/ExportButton";
import { MonthlyNRGrid } from "@/components/panels/nrd/MonthlyNRGrid";
import { NRTrendChart } from "@/components/panels/nrd/NRTrendChart";
export default function NRDPage() {
  const [njId, setNjId] = useState<Id<"newJoiners"> | "all">("all");
  const njs = useQuery(api.queries.newJoiners.list, {});
  const grid = useQuery(api.queries.nr.monthlyGrid);
  const perf = useQuery(api.queries.nr.performingCount);
  const firstNJ = njs?.[0]?._id;
  const activeNJ = njId !== "all" ? njId : firstNJ;
  const singleNR = useQuery(api.queries.nr.byNJ, activeNJ ? { njId: activeNJ } : "skip");
  const njNames = Object.fromEntries(njs?.map((n: Doc<"newJoiners">) => [n._id, n.name]) ?? []);
  const njIds = njs?.map((n: Doc<"newJoiners">) => n._id) ?? [];
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-gray-900">Net Revenue (NRD)</h1><p className="text-sm text-gray-500 mt-0.5">Monthly NR performance tracking</p></div>
        <div className="flex items-center gap-3"><NJFilter value={njId} onChange={setNjId} /><ExportButton /></div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-1">Performing (This Month)</div><div className="text-2xl font-bold text-emerald-600">{perf?.performing??<span className="text-gray-300">—</span>}</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-1">Non-Performing</div><div className="text-2xl font-bold text-red-600">{perf?.nonPerforming??<span className="text-gray-300">—</span>}</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-1">Total NJs</div><div className="text-2xl font-bold text-gray-900">{perf?.total??<span className="text-gray-300">—</span>}</div></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly NR Grid (All NJs)</h2>
        {grid ? <MonthlyNRGrid records={grid.records} months={grid.months} njIds={njIds} njNames={njNames} /> : <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">NR Trend — {njId==="all"?"First NJ":njs?.find((n: Doc<"newJoiners">)=>n._id===njId)?.name}</h2>
        {singleNR ? <NRTrendChart records={singleNR} /> : <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />}
      </div>
    </div>
  );
}
