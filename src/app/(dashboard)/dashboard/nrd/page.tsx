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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Net Revenue (NRD)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monthly NR performance tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <NJFilter value={njId} onChange={setNjId} />
          <ExportButton />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 stagger">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Performing (This Month)</div>
          <div className="text-4xl font-black">{perf?.performing ?? <span className="text-white/40">—</span>}</div>
          <div className="text-xs text-white/60 mt-1">CSMs with positive NR</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Non-Performing</div>
          <div className="text-4xl font-black">{perf?.nonPerforming ?? <span className="text-white/40">—</span>}</div>
          <div className="text-xs text-white/60 mt-1">CSMs with negative NR</div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Total NJs</div>
          <div className="text-4xl font-black">{perf?.total ?? <span className="text-white/40">—</span>}</div>
          <div className="text-xs text-white/60 mt-1">Active this month</div>
        </div>
      </div>

      {/* Monthly NR Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly NR Grid — All CSMs</h2>
        {grid
          ? <MonthlyNRGrid records={grid.records} months={grid.months} njIds={njIds} njNames={njNames} />
          : <div className="animate-pulse h-48 bg-gray-50 rounded-xl" />}
      </div>

      {/* NR Trend Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          NR Trend — {njId === "all" ? "First NJ" : njs?.find((n: Doc<"newJoiners">) => n._id === njId)?.name}
        </h2>
        {singleNR
          ? <NRTrendChart records={singleNR} />
          : <div className="animate-pulse h-48 bg-gray-50 rounded-xl" />}
      </div>
    </div>
  );
}
