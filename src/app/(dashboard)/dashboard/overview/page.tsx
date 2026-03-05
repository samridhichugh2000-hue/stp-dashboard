"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
const TODAY = new Date().toISOString().split("T")[0];
import { HuddleLog } from "@/components/panels/overview/HuddleLog";
import { DayTaskTracker, HuddleStatus } from "@/components/panels/overview/DayTaskTracker";
import { NJDetailModal } from "@/components/panels/overview/NJDetailModal";
import { ExportButton } from "@/components/shared/ExportButton";
import {
  Users, Search, X,
  Building2, MapPin, Mail, Hash, UserCircle2, CalendarDays, ChevronRight,
} from "lucide-react";
import { fmtTenure } from "@/lib/formatTenure";

// ── Display category ──────────────────────────────────────────────────────────

type DisplayCategory = "Developed" | "Not Developed" | "STP WIP" | "Inactive";

function getDisplayCategory(nj: Doc<"newJoiners">): DisplayCategory {
  if (!nj.isActive) return "Inactive";
  const daysSinceJoining = (Date.now() - new Date(nj.joinDate).getTime()) / 86_400_000;
  // Uncategorised means not yet evaluated — keep in STP WIP regardless of tenure
  if (daysSinceJoining < 30 || nj.category === "Uncategorised") return "STP WIP";
  if (nj.category === "Developed") return "Developed";
  return "Not Developed";
}

const CATEGORY_STYLE: Record<DisplayCategory, string> = {
  "Developed":     "bg-emerald-100 text-emerald-700",
  "Not Developed": "bg-red-100 text-red-600",
  "STP WIP":       "bg-violet-100 text-violet-700",
  "Inactive":      "bg-gray-100 text-gray-400",
};

const FILTER_OPTIONS: Array<DisplayCategory | "All"> = [
  "All", "STP WIP", "Developed", "Not Developed", "Inactive",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count Mon–Fri days from DOJ+1 through today (inclusive). */
function workingDaysSince(dojISO: string): number {
  const doj = new Date(dojISO);
  doj.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(doj);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function fmtDOJ(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [selectedNJId, setSelectedNJId]     = useState<Id<"newJoiners"> | null>(null);
  const [modalNJ, setModalNJ]               = useState<Doc<"newJoiners"> | null>(null);
  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DisplayCategory | "All">("All");
  const [managerFilter, setManagerFilter]   = useState<string>("All");

  const njs        = useQuery(api.queries.newJoiners.list, { includeInactive: true });
  const alerts     = useQuery(api.queries.performance.pendingAlerts);
  const huddleLogs = useQuery(api.queries.huddleLogs.byNJ, selectedNJId ? { njId: selectedNJId } : "skip");

  if (!njs) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}
        </div>
        <div className="shimmer h-96 rounded-2xl" />
      </div>
    );
  }

  // Filter out garbage records: Convex IDs as manager names, mock empIds, empty names
  const isGarbage = (nj: Doc<"newJoiners">) => {
    if (!nj.name?.trim()) return true;
    if (!nj.empId) return true;
    if (nj.empId.startsWith("MOCK-")) return true;
    const mid = nj.managerId ?? "";
    if (mid.length >= 25 && !/\s/.test(mid) && /^[a-zA-Z0-9]+$/.test(mid)) return true;
    return false;
  };

  // Sort: latest join date first; active before inactive at the same date
  const allNJs = [...njs].filter((n: Doc<"newJoiners">) => !isGarbage(n)).sort((a: Doc<"newJoiners">, b: Doc<"newJoiners">) => {
    const d = b.joinDate.localeCompare(a.joinDate);
    if (d !== 0) return d;
    return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
  });

  const activeCount    = allNJs.filter((n: Doc<"newJoiners">) => n.isActive).length;
  const devCount       = allNJs.filter((n: Doc<"newJoiners">) => getDisplayCategory(n) === "Developed").length;
  const notDevCount    = allNJs.filter((n: Doc<"newJoiners">) => getDisplayCategory(n) === "Not Developed").length;
  const wipCount       = allNJs.filter((n: Doc<"newJoiners">) => getDisplayCategory(n) === "STP WIP").length;
  const inactiveCount  = allNJs.filter((n: Doc<"newJoiners">) => !n.isActive).length;
  const alertCount     = alerts?.length ?? 0;
  const devRate        = (devCount + notDevCount) > 0 ? Math.round(devCount / (devCount + notDevCount) * 100) : 0;

  const categoryCounts: Record<string, number> = {
    "All": allNJs.length,
    "STP WIP": wipCount,
    "Developed": devCount,
    "Not Developed": notDevCount,
    "Inactive": inactiveCount,
  };

  // Unique manager list sorted alphabetically (exclude blanks)
  const managerList = [...new Set(
    allNJs.map((n: Doc<"newJoiners">) => n.managerId).filter(Boolean)
  )].sort() as string[];

  const q = search.trim().toLowerCase();
  const filteredNJs = allNJs.filter((n: Doc<"newJoiners">) => {
    const matchesSearch =
      !q ||
      n.name.toLowerCase().includes(q) ||
      (n.empId ?? "").toLowerCase().includes(q) ||
      (n.managerId ?? "").toLowerCase().includes(q);
    const matchesCategory =
      categoryFilter === "All" || getDisplayCategory(n) === categoryFilter;
    const matchesManager =
      managerFilter === "All" || n.managerId === managerFilter;
    return matchesSearch && matchesCategory && matchesManager;
  });

  // ── Chart data (reacts to both categoryFilter and managerFilter) ──────────
  const showCharts = categoryFilter !== "All" || managerFilter !== "All";

  // Category breakdown of the currently visible NJs (for manager view or "All" view)
  const chartBase = managerFilter !== "All"
    ? allNJs.filter((n: Doc<"newJoiners">) => n.managerId === managerFilter)
    : allNJs;

  const catPieData = [
    { name: "Developed",     value: chartBase.filter((n: Doc<"newJoiners">) => getDisplayCategory(n) === "Developed").length,     color: "#10b981" },
    { name: "Not Developed", value: chartBase.filter((n: Doc<"newJoiners">) => getDisplayCategory(n) === "Not Developed").length, color: "#ef4444" },
    { name: "STP WIP",       value: chartBase.filter((n: Doc<"newJoiners">) => getDisplayCategory(n) === "STP WIP").length,       color: "#8b5cf6" },
    { name: "Inactive",      value: chartBase.filter((n: Doc<"newJoiners">) => !n.isActive).length,                               color: "#9ca3af" },
  ].filter(d => d.value > 0);

  // Tenure bucket breakdown of filteredNJs (responds to category + manager filter)
  const tenureBuckets = [
    { name: "< 1 mo",  min: 0,  max: 1  },
    { name: "1–3 mo",  min: 1,  max: 3  },
    { name: "3–6 mo",  min: 3,  max: 6  },
    { name: "6–12 mo", min: 6,  max: 12 },
    { name: "> 12 mo", min: 12, max: Infinity },
  ];
  const tenureBarData = tenureBuckets.map(b => {
    const count = filteredNJs.filter((n: Doc<"newJoiners">) => {
      const months = (Date.now() - new Date(n.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30.5);
      return months >= b.min && months < b.max;
    }).length;
    return { name: b.name, count };
  }).filter(b => b.count > 0);

  // Phase breakdown of filteredNJs
  const phaseColors: Record<string, string> = {
    Orientation: "#a5b4fc", Training: "#6ee7b7", Field: "#fcd34d", Graduated: "#fb923c",
  };
  const phaseBarData = ["Orientation", "Training", "Field", "Graduated"].map(phase => ({
    name: phase,
    count: filteredNJs.filter((n: Doc<"newJoiners">) => n.currentPhase === phase).length,
  })).filter(d => d.count > 0);

  const selectedNJ = selectedNJId
    ? allNJs.find((n: Doc<"newJoiners">) => n._id === selectedNJId) ?? null
    : null;

  // Only show huddle task for NJs within 15 working days of joining
  const selectedNJWorkingDays = selectedNJ ? workingDaysSince(selectedNJ.joinDate) : 0;
  const isInHuddleWindow = selectedNJWorkingDays < 15;

  const todayHuddle = huddleLogs?.find((l: Doc<"huddleLogs">) => l.date === TODAY);
  const huddleStatus: HuddleStatus =
    todayHuddle?.completed ? "done" :
    todayHuddle            ? "missed" :
    "pending";

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            NJ Overview
            <span className="ml-3 text-base font-medium text-gray-400">{activeCount} Active CSMs</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor your new joiner pipeline in real time</p>
        </div>
        <ExportButton />
      </div>

      {/* ── KPI Summary Strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
        {([
          { label: "Active CSMs",   value: activeCount,  sub: "in program",                      bg: "from-indigo-500 to-violet-600",    cat: "All"           },
          { label: "Developed",     value: devCount,     sub: `${devRate}% success rate`,         bg: "from-emerald-500 to-teal-600",     cat: "Developed"     },
          { label: "Not Developed", value: notDevCount,  sub: "need support",                     bg: "from-red-500 to-rose-600",         cat: "Not Developed" },
          { label: "STP WIP",       value: wipCount,     sub: "in training / pending eval",       bg: "from-violet-500 to-purple-600",    cat: "STP WIP"       },
        ] as { label: string; value: number; sub: string; bg: string; cat: DisplayCategory | "All" }[]).map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setCategoryFilter(kpi.cat)}
            className={`bg-gradient-to-br ${kpi.bg} rounded-2xl p-4 text-white text-left shadow-lg card-hover focus:outline-none animate-slide-up w-full`}
          >
            <div className="text-[11px] font-medium text-white/70 mb-1">{kpi.label}</div>
            <div className="text-3xl font-black tabular-nums">{kpi.value}</div>
            <div className="text-[11px] text-white/60 mt-1">{kpi.sub}</div>
          </button>
        ))}
      </div>

      {/* ── Charts Panel (shown on category click or manager filter) ─────────── */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">

          {/* Donut — category breakdown of current scope */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {managerFilter !== "All" ? `${managerFilter} — Category Split` : `${categoryFilter} — Overview`}
            </h3>
            <p className="text-[11px] text-gray-400 mb-3">Distribution across all statuses</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={76} dataKey="value" paddingAngle={3}>
                    {catPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}
                    formatter={(val, name) => [`${val} CSMs`, name]}
                  />
                  <Legend iconType="circle" iconSize={9} formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar — tenure distribution of filtered NJs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tenure Distribution</h3>
            <p className="text-[11px] text-gray-400 mb-3">
              {filteredNJs.length} CSM{filteredNJs.length !== 1 ? "s" : ""} in current view
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenureBarData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}
                    formatter={(val) => [`${val} CSMs`, "Count"]}
                    cursor={{ fill: "#f9fafb" }}
                  />
                  <Bar dataKey="count" fill="#a5b4fc" radius={[5, 5, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#6b7280" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar — phase breakdown of filtered NJs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phase Breakdown</h3>
            <p className="text-[11px] text-gray-400 mb-3">Current training phase distribution</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseBarData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}
                    formatter={(val) => [`${val} CSMs`, "Count"]}
                    cursor={{ fill: "#f9fafb" }}
                  />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {phaseBarData.map((entry, i) => (
                      <Cell key={i} fill={phaseColors[entry.name] ?? "#a5b4fc"} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#6b7280" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* ── Table + Detail Panel ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: table */}
        <div className="lg:col-span-2 space-y-3">

          {/* Search + category filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-400 transition-all bg-gray-50">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by name, Emp ID or manager…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X size={14} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Category filter pills + Manager dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setCategoryFilter(opt)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1 ${
                      categoryFilter === opt
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {opt}
                    <span className={`text-[10px] ${categoryFilter === opt ? "text-white/70" : "text-gray-400"}`}>
                      {categoryCounts[opt]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Manager filter dropdown */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <UserCircle2 size={13} className="text-gray-400" />
                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  className="text-[11px] font-medium border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all max-w-[180px] truncate"
                >
                  <option value="All">All Managers</option>
                  {managerList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {managerFilter !== "All" && (
                  <button onClick={() => setManagerFilter("All")} className="text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Sales New Joiners</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filteredNJs.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Emp ID</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tenure</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Manager</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredNJs.map((nj: Doc<"newJoiners">) => {
                    const isSelected = selectedNJId === nj._id;
                    const hasAlert   = (alerts?.some((a: Doc<"performanceAlerts">) => a.njId === nj._id)) ?? false;
                    const displayCat = getDisplayCategory(nj);
                    const catStyle   = CATEGORY_STYLE[displayCat];
                    return (
                      <tr
                        key={nj._id}
                        onClick={() => setSelectedNJId(isSelected ? null : nj._id)}
                        className={`cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${
                          isSelected
                            ? "bg-indigo-50"
                            : nj.isActive
                            ? "hover:bg-gray-50"
                            : "bg-gray-50/60 hover:bg-gray-100/60"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              nj.isActive
                                ? "bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-sm"
                                : "bg-gray-200 text-gray-400"
                            }`}>
                              {initials(nj.name)}
                            </div>
                            {hasAlert && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalNJ(nj);
                              }}
                              className={`font-medium text-left hover:text-indigo-600 hover:underline transition-colors ${nj.isActive ? "text-gray-900" : "text-gray-400"}`}
                            >
                              {nj.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{nj.empId ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${catStyle}`}>
                            {displayCat}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtTenure(nj.joinDate)}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[130px] truncate">{nj.managerId || "—"}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDOJ(nj.joinDate)}</td>
                        <td className="px-4 py-3">
                          <ChevronRight size={14} className={`transition-colors ${isSelected ? "text-indigo-500" : "text-gray-300"}`} />
                        </td>
                      </tr>
                    );
                  })}
                  {filteredNJs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-gray-400 text-sm">
                        No records found{search ? ` for "${search}"` : managerFilter !== "All" ? ` under "${managerFilter}"` : categoryFilter !== "All" ? ` in "${categoryFilter}"` : ""}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-1 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          {selectedNJ ? (
            <div className="space-y-4 animate-scale-in">

              {/* Header */}
              <div className={`rounded-2xl p-5 text-white shadow-lg ${selectedNJ.isActive ? "bg-gradient-to-br from-indigo-600 to-violet-700" : "bg-gradient-to-br from-gray-500 to-gray-600"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-base font-bold flex-shrink-0">
                    {initials(selectedNJ.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-snug">{selectedNJ.name}</h3>
                    {selectedNJ.designation && (
                      <p className="text-white/70 text-xs mt-0.5">{selectedNJ.designation}</p>
                    )}
                    <p className="text-white/50 text-xs mt-1">
                      Joined {fmtDOJ(selectedNJ.joinDate)} · {fmtTenure(selectedNJ.joinDate)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">{selectedNJ.currentPhase}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">{getDisplayCategory(selectedNJ)}</span>
                </div>
              </div>

              {/* Profile fields */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Profile</p>
                </div>
                <div className="grid grid-cols-2 gap-px bg-gray-100">
                  {([
                    { icon: <Hash size={12} />,         label: "Emp ID",      value: selectedNJ.empId },
                    { icon: <UserCircle2 size={12} />,  label: "Manager",     value: selectedNJ.managerId },
                    { icon: <MapPin size={12} />,       label: "Location",    value: selectedNJ.location },
                    { icon: <Building2 size={12} />,    label: "Department",  value: selectedNJ.department },
                    { icon: <Mail size={12} />,         label: "Email",       value: selectedNJ.email },
                    { icon: <CalendarDays size={12} />, label: "DOJ",         value: fmtDOJ(selectedNJ.joinDate) },
                  ] as { icon: React.ReactNode; label: string; value: string | undefined }[]).map(({ icon, label, value }) => (
                    <div key={label} className="bg-white px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                        {icon}
                        <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
                      </div>
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {value || <span className="text-gray-300">—</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedNJ.isActive && (
                <>
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <DayTaskTracker huddleStatus={isInHuddleWindow ? huddleStatus : undefined} />
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <HuddleLog njId={selectedNJId!} />
                  </div>
                </>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 bg-white rounded-2xl border border-dashed border-gray-200 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Users size={28} className="text-indigo-400" />
              </div>
              <p className="text-gray-700 font-semibold">Select a record</p>
              <p className="text-sm text-gray-400 mt-1">Click any row to view profile, tasks and huddle logs.</p>
            </div>
          )}
        </div>

      </div>

      {/* NJ Detail Modal */}
      {modalNJ && (
        <NJDetailModal
          nj={modalNJ}
          onClose={() => setModalNJ(null)}
        />
      )}
    </div>
  );
}
