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
  const stats = useQuery(api.queries.nr.nrdStats);
  const firstNJ = njs?.[0]?._id;
  const activeNJ = njId !== "all" ? njId : firstNJ;
  const singleNR = useQuery(api.queries.nr.byNJ, activeNJ ? { njId: activeNJ } : "skip");
  const njNames = Object.fromEntries(njs?.map((n: Doc<"newJoiners">) => [n._id, n.name]) ?? []);
  const njDesignations = Object.fromEntries(njs?.flatMap((n: Doc<"newJoiners">) => n.designation ? [[n._id, n.designation]] : []) ?? []);
  const njIds = njs?.map((n: Doc<"newJoiners">) => n._id) ?? [];

  const statCards = [
    {
      label: "Currently Positive",
      value: stats?.totalPositive,
      desc: "NJs with latest NR positive",
      bg: "from-amber-400 to-yellow-500",
    },
    {
      label: "Currently Negative",
      value: stats?.totalNegative,
      desc: "NJs with latest NR negative",
      bg: "from-red-500 to-rose-600",
    },
    {
      label: "Positive within 4 mo",
      value: stats?.positiveWithin4,
      desc: "New joiners already positive",
      bg: "from-emerald-500 to-teal-600",
    },
    {
      label: "Negative after 4 mo",
      value: stats?.negativeAfter4,
      desc: "NJs still negative past 4 months",
      bg: "from-slate-600 to-gray-700",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Net Revenue (NRD)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monthly NR performance tracking</p>
        </div>
        <ExportButton />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {statCards.map(c => (
          <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}>
            <div className="text-xs font-medium text-white/70 mb-2">{c.label}</div>
            <div className="text-4xl font-black">
              {c.value ?? <span className="text-white/40">—</span>}
            </div>
            <div className="text-xs text-white/60 mt-1">{c.desc}</div>
          </div>
        ))}
      </div>

      {/* Monthly NR Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly NR Grid — All CSMs</h2>
        {grid
          ? <MonthlyNRGrid records={grid.records} months={grid.months} njIds={njIds} njNames={njNames} njDesignations={njDesignations} />
          : <div className="animate-pulse h-48 bg-gray-50 rounded-xl" />}
      </div>

      {/* NR Trend Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            NR Trend — {njId === "all" ? "First NJ" : njs?.find((n: Doc<"newJoiners">) => n._id === njId)?.name}
          </h2>
          <NJFilter value={njId} onChange={setNjId} />
        </div>
        {singleNR
          ? <NRTrendChart records={singleNR} />
          : <div className="animate-pulse h-48 bg-gray-50 rounded-xl" />}
      </div>
    </div>
  );
}
