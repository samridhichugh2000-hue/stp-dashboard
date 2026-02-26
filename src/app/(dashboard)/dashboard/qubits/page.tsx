"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { clsx } from "clsx";
import { Search, X, CheckCircle2, Clock, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";

export default function QubitsPage() {
  const [selectedNJId, setSelectedNJId] = useState<Id<"newJoiners"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const summary = useQuery(api.queries.qubits.allSummary);
  const scores = useQuery(
    api.queries.qubits.byNJ,
    selectedNJId ? { njId: selectedNJId } : "skip"
  );

  if (!summary) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}
        </div>
        <div className="shimmer h-96 rounded-2xl" />
      </div>
    );
  }

  // Position-based status: rows 1–21 and 23–25 (0-indexed: 0–20, 22–24) = Completed; rest = Pending
  function qubitStatus(idx: number): "Completed" | "Pending" {
    return (idx <= 20 || (idx >= 22 && idx <= 24)) ? "Completed" : "Pending";
  }

  const selectedCSM      = selectedNJId ? summary.find((r) => r._id === selectedNJId) : null;
  const totalCompleted   = scores?.length ?? 0;
  const totalAbove50     = scores?.filter((s) => s.score >= 50).length ?? 0;
  const totalBelow50     = scores?.filter((s) => s.score < 50).length ?? 0;

  const filtered = searchQuery.trim()
    ? summary.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  function selectCSM(id: Id<"newJoiners">, name: string) {
    setSelectedNJId(id);
    setSearchQuery(name);
    setDropdownOpen(false);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Qubits</h1>
      </div>

      {/* ── Top stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">CSMs Completed Qubits</div>
          <div className="text-4xl font-black">24</div>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">CSMs Qubits Pending</div>
          <div className="text-4xl font-black">5</div>
        </div>
      </div>

      {/* ── Search dropdown + Table | Detail panel ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: search + table */}
        <div className="lg:col-span-3 space-y-4">

          {/* Search dropdown */}
          <div className="relative">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-400 transition-all bg-white shadow-sm">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search CSM by name…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
              {(searchQuery || selectedNJId) && (
                <button onClick={() => { setSearchQuery(""); setSelectedNJId(null); setDropdownOpen(false); }}>
                  <X size={14} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {dropdownOpen && filtered.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {filtered.slice(0, 8).map((r) => {
                  const idx = summary.findIndex((s) => s._id === r._id);
                  const status = qubitStatus(idx);
                  return (
                    <button
                      key={r._id}
                      onMouseDown={() => selectCSM(r._id, r.name)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className={clsx(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        status === "Completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">CSM Name</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Emp ID</th>
                  <th className="text-center py-2.5 px-4 text-xs font-semibold text-gray-500">Qubit Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {summary.map((row, i) => {
                  const status = qubitStatus(i);
                  return (
                    <tr
                      key={row._id}
                      onClick={() => selectCSM(row._id, row.name)}
                      className={clsx(
                        "cursor-pointer transition-colors group",
                        selectedNJId === row._id ? "bg-indigo-50" : "hover:bg-gray-50/60"
                      )}
                    >
                      <td className="py-2.5 px-4 text-xs text-gray-300">{i + 1}</td>
                      <td className="py-2.5 px-4">
                        <p className={clsx("text-xs font-semibold", selectedNJId === row._id ? "text-indigo-700" : "text-gray-800")}>{row.name}</p>
                        {row.designation && <p className="text-[10px] text-gray-400 mt-0.5">{row.designation}</p>}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{row.empId ?? "—"}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={clsx(
                          "inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full",
                          status === "Completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <ChevronRight size={14} className={clsx("transition-colors", selectedNJId === row._id ? "text-indigo-400" : "text-gray-200 group-hover:text-gray-400")} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-2">
          {selectedCSM ? (
            <div className="space-y-4 animate-scale-in">
              {/* CSM header */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm mb-3">
                  {selectedCSM.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <h3 className="text-base font-bold">{selectedCSM.name}</h3>
                {selectedCSM.designation && <p className="text-indigo-200 text-xs mt-0.5">{selectedCSM.designation}</p>}
                {selectedCSM.empId && <p className="text-indigo-300 text-xs mt-0.5">ID: {selectedCSM.empId}</p>}
              </div>

              {/* 4 stat cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Qubits Completed", value: totalCompleted, icon: <CheckCircle2 size={16} />, bg: "from-indigo-500 to-violet-600" },
                  { label: "Total Qubits Pending",   value: 0,              icon: <Clock size={16} />,        bg: "from-gray-400 to-gray-500" },
                  { label: "Score ≥ 50",             value: totalAbove50,   icon: <TrendingUp size={16} />,   bg: "from-emerald-500 to-teal-600" },
                  { label: "Score < 50",             value: totalBelow50,   icon: <TrendingDown size={16} />, bg: "from-rose-500 to-red-600" },
                ].map((c) => (
                  <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-xl p-4 text-white shadow-md`}>
                    <div className="flex items-center gap-1.5 text-white/70 mb-2">{c.icon}<span className="text-[10px] font-semibold uppercase tracking-wide">{c.label}</span></div>
                    <div className="text-3xl font-black">{scores ? c.value : <span className="text-white/40 text-xl">—</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 bg-white rounded-2xl border border-dashed border-gray-200 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Search size={24} className="text-indigo-400" />
              </div>
              <p className="text-gray-700 font-semibold">Select a CSM</p>
              <p className="text-sm text-gray-400 mt-1">Click a row or search above to view qubit details.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
