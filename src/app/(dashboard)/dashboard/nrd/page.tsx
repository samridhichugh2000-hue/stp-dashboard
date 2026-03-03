"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import { ExportButton } from "@/components/shared/ExportButton";
import { MonthlyNRGrid } from "@/components/panels/nrd/MonthlyNRGrid";

export default function NRDPage() {
  const [selectedNjId, setSelectedNjId] = useState<string>("");
  const [gridSearch, setGridSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("All");

  const njs = useQuery(api.queries.newJoiners.list, {});
  const grid = useQuery(api.queries.nr.monthlyGrid);
  const stats = useQuery(api.queries.nr.nrdStats);

  const managerList = [...new Set((njs ?? []).map((n: Doc<"newJoiners">) => n.managerId).filter(Boolean))].sort() as string[];
  const filteredNjs = managerFilter === "All" ? (njs ?? []) : (njs ?? []).filter((n: Doc<"newJoiners">) => n.managerId === managerFilter);

  const njNames = Object.fromEntries((njs ?? []).map((n: Doc<"newJoiners">) => [n._id, n.name]));
  const njJoinDates = Object.fromEntries((njs ?? []).map((n: Doc<"newJoiners">) => [n._id, n.joinDate]));
  const njTenures = Object.fromEntries((njs ?? []).map((n: Doc<"newJoiners">) => [n._id, n.tenureMonths]));
  const njIds = filteredNjs.map((n: Doc<"newJoiners">) => n._id);

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Monthly NR Grid — All CSMs</h2>
          <div className="flex items-center gap-2">
            {/* Manager filter */}
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus-within:ring-2 focus-within:ring-indigo-300 transition-all">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <select
                value={managerFilter}
                onChange={e => setManagerFilter(e.target.value)}
                className="text-xs bg-transparent text-gray-600 focus:outline-none max-w-[140px] cursor-pointer"
              >
                <option value="All">All Managers</option>
                {managerList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {managerFilter !== "All" && (
                <button onClick={() => setManagerFilter("All")} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {/* Name search */}
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search name…"
                value={gridSearch}
                onChange={e => setGridSearch(e.target.value)}
                className="text-xs pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder-gray-400 w-40"
              />
            </div>
          </div>
        </div>
        {grid
          ? <MonthlyNRGrid
              records={grid.records}
              months={grid.months}
              njIds={njIds}
              njNames={njNames}
              njJoinDates={njJoinDates}
              njTenures={njTenures}
              filter={gridSearch}
              selectedNjId={selectedNjId}
              onSelect={(id) => setSelectedNjId(id)}
            />
          : <div className="animate-pulse h-48 bg-gray-50 rounded-xl" />}
      </div>

    </div>
  );
}
