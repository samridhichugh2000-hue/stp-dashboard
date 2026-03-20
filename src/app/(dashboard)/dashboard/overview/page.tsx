"use client";

import { useState, useEffect } from "react";
import type { NJ, PerformanceAlert, HuddleLog as HuddleLogType } from "@/lib/types";
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
  UserPlus, Calendar,
} from "lucide-react";
import { fmtTenure } from "@/lib/formatTenure";

interface UpcomingJoining {
  id: number;
  name: string;
  manager: string | null;
  country: string | null;
  tentativeDoj: string | null;
  status: string;           // pending | joined | backed_out
  emailReceivedAt: string | null;
}

type DisplayCategory = "Developed" | "Not Developed" | "STP WIP" | "Inactive";
type FilterOption = DisplayCategory | "All" | "Active";

function getDisplayCategory(nj: NJ): DisplayCategory {
  if (!nj.isActive) return "Inactive";
  const wds = workingDaysSince(nj.joinDate);
  if (wds <= 14) return "STP WIP";                            // Standard 14-day window
  if (wds <= 18 && nj.stpExtendedDays > 0) return "STP WIP"; // Extended window still active
  if (wds <= 18 && nj.stpExtendedDays === 0) return "STP WIP"; // In extended range but no meetings yet
  return nj.hasPositiveNR ? "Developed" : "Not Developed";    // Based on actual NR performance
}

const CATEGORY_STYLE: Record<DisplayCategory, string> = {
  "Developed":     "bg-emerald-100 text-emerald-700",
  "Not Developed": "bg-red-100 text-red-600",
  "STP WIP":       "bg-violet-100 text-violet-700",
  "Inactive":      "bg-gray-100 text-gray-400",
};

const FILTER_OPTIONS: FilterOption[] = [
  "All", "Active", "STP WIP", "Developed", "Not Developed", "Inactive",
];

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

export default function OverviewPage() {
  const [selectedNJId, setSelectedNJId]     = useState<number | null>(null);
  const [modalNJ, setModalNJ]               = useState<NJ | null>(null);
  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterOption>("All");
  const [managerFilter, setManagerFilter]   = useState<string>("All");

  const [njs,             setNjs]             = useState<NJ[] | null>(null);
  const [alerts,          setAlerts]          = useState<PerformanceAlert[] | null>(null);
  const [huddleLogs,      setHuddleLogs]      = useState<HuddleLogType[] | null>(null);
  const [joinings,        setJoinings]        = useState<UpcomingJoining[] | null>(null);
  const [joiningsLoading, setJoiningsLoading] = useState(false);
  const [joiningsError,   setJoiningsError]   = useState<string | null>(null);

  // DSR tracking — keyed by njId
  const [dsrMap,        setDsrMap]        = useState<Map<number, { submittedAt: string | null }>>(new Map());
  const [dsrLoading,    setDsrLoading]    = useState(false);

  useEffect(() => {
    fetch("/api/nj?includeInactive=true")
      .then(r => r.json()).then(setNjs).catch(() => setNjs([]));
    fetch("/api/performance/alerts")
      .then(r => r.ok ? r.json() : []).then(setAlerts).catch(() => setAlerts([]));
  }, []);

  const fetchDSR = () => {
    setDsrLoading(true);
    fetch("/api/outlook/dsr")
      .then(r => r.json())
      .then(data => {
        if (data?.njs) {
          const map = new Map<number, { submittedAt: string | null }>();
          for (const nj of data.njs) {
            if (nj.dsrToday) map.set(nj.njId, { submittedAt: nj.submittedAt });
          }
          setDsrMap(map);
        }
      })
      .catch(() => {})
      .finally(() => setDsrLoading(false));
  };

  useEffect(() => { fetchDSR(); }, []);

  const fetchJoinings = () => {
    setJoiningsLoading(true);
    setJoiningsError(null);
    fetch("/api/outlook/joinings")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setJoinings(data);
        else setJoiningsError(data.error ?? "Failed to load joinings");
      })
      .catch(e => setJoiningsError(e.message))
      .finally(() => setJoiningsLoading(false));
  };

  useEffect(() => { fetchJoinings(); }, []);

  const updateJoiningStatus = async (id: number, status: string) => {
    // Optimistic update
    setJoinings(prev => prev?.map(j => j.id === id ? { ...j, status } : j) ?? prev);
    try {
      const res = await fetch("/api/outlook/joinings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert on failure
      fetchJoinings();
    }
  };

  useEffect(() => {
    if (selectedNJId === null) { setHuddleLogs(null); return; }
    fetch(`/api/huddle?njId=${selectedNJId}`)
      .then(r => r.json()).then(setHuddleLogs).catch(() => setHuddleLogs([]));
  }, [selectedNJId]);

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

  const isGarbage = (nj: NJ) => {
    if (!nj.name?.trim()) return true;
    if (!nj.empId) return true;
    if (nj.empId.startsWith("MOCK-")) return true;
    const mid = nj.managerId ?? "";
    if (mid.length >= 25 && !/\s/.test(mid) && /^[a-zA-Z0-9]+$/.test(mid)) return true;
    return false;
  };

  const allNJs = [...njs].filter((n: NJ) => !isGarbage(n)).filter((n: NJ) => {
    const months = (Date.now() - new Date(n.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30.5);
    return months < 12;
  }).sort((a: NJ, b: NJ) => {
    const d = b.joinDate.localeCompare(a.joinDate);
    if (d !== 0) return d;
    return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
  });

  const activeCount   = allNJs.filter((n: NJ) => n.isActive).length;
  const devCount      = allNJs.filter((n: NJ) => getDisplayCategory(n) === "Developed").length;
  const notDevCount   = allNJs.filter((n: NJ) => getDisplayCategory(n) === "Not Developed").length;
  const wipCount      = allNJs.filter((n: NJ) => getDisplayCategory(n) === "STP WIP").length;
  const inactiveCount = allNJs.filter((n: NJ) => !n.isActive).length;
  const alertCount    = alerts?.length ?? 0;
  const devRate       = (devCount + notDevCount) > 0 ? Math.round(devCount / (devCount + notDevCount) * 100) : 0;

  const categoryCounts: Record<string, number> = {
    "All": allNJs.length,
    "Active": activeCount,
    "STP WIP": wipCount,
    "Developed": devCount,
    "Not Developed": notDevCount,
    "Inactive": inactiveCount,
  };

  const managerList = [...new Set(
    allNJs.map((n: NJ) => n.managerId).filter(Boolean)
  )].sort() as string[];

  const q = search.trim().toLowerCase();
  const filteredNJs = allNJs.filter((n: NJ) => {
    const matchesSearch =
      !q ||
      n.name.toLowerCase().includes(q) ||
      (n.empId ?? "").toLowerCase().includes(q) ||
      (n.managerId ?? "").toLowerCase().includes(q);
    const matchesCategory =
      categoryFilter === "All" ||
      (categoryFilter === "Active" ? n.isActive : getDisplayCategory(n) === categoryFilter);
    const matchesManager =
      managerFilter === "All" || n.managerId === managerFilter;
    return matchesSearch && matchesCategory && matchesManager;
  });

  const showCharts = categoryFilter !== "All" || managerFilter !== "All";

  const chartBase = managerFilter !== "All"
    ? allNJs.filter((n: NJ) => n.managerId === managerFilter)
    : allNJs;

  const catPieData = [
    { name: "Developed",     value: chartBase.filter((n: NJ) => getDisplayCategory(n) === "Developed").length,     color: "#10b981" },
    { name: "Not Developed", value: chartBase.filter((n: NJ) => getDisplayCategory(n) === "Not Developed").length, color: "#ef4444" },
    { name: "STP WIP",       value: chartBase.filter((n: NJ) => getDisplayCategory(n) === "STP WIP").length,       color: "#8b5cf6" },
    { name: "Inactive",      value: chartBase.filter((n: NJ) => !n.isActive).length,                               color: "#9ca3af" },
  ].filter(d => d.value > 0);

  const tenureBuckets = [
    { name: "< 1 mo",  min: 0,  max: 1  },
    { name: "1–3 mo",  min: 1,  max: 3  },
    { name: "3–6 mo",  min: 3,  max: 6  },
    { name: "6–12 mo", min: 6,  max: 12 },
    { name: "> 12 mo", min: 12, max: Infinity },
  ];
  const tenureBarData = tenureBuckets.map(b => {
    const count = filteredNJs.filter((n: NJ) => {
      const months = (Date.now() - new Date(n.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30.5);
      return months >= b.min && months < b.max;
    }).length;
    return { name: b.name, count };
  }).filter(b => b.count > 0);

  const phaseColors: Record<string, string> = {
    Orientation: "#a5b4fc", Training: "#6ee7b7", Field: "#fcd34d", Graduated: "#fb923c",
  };
  const phaseBarData = ["Orientation", "Training", "Field", "Graduated"].map(phase => ({
    name: phase,
    count: filteredNJs.filter((n: NJ) => n.currentPhase === phase).length,
  })).filter(d => d.count > 0);

  const selectedNJ = selectedNJId
    ? allNJs.find((n: NJ) => n.id === selectedNJId) ?? null
    : null;

  const selectedNJWorkingDays = selectedNJ ? workingDaysSince(selectedNJ.joinDate) : 0;
  const isInHuddleWindow = selectedNJWorkingDays <= 18;

  const todayHuddle = huddleLogs?.find((l: HuddleLogType) => l.date === TODAY);
  const huddleStatus: HuddleStatus =
    todayHuddle?.completed ? "done" :
    todayHuddle            ? "missed" :
    "pending";

  return (
    <div className="space-y-6 animate-fade-in">

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

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
        {([
          { label: "Active CSMs",   value: activeCount,  sub: "in program",                 bg: "from-indigo-500 to-violet-600",  cat: "All"           },
          { label: "Developed",     value: devCount,     sub: `${devRate}% success rate`,    bg: "from-emerald-500 to-teal-600",   cat: "Developed"     },
          { label: "Not Developed", value: notDevCount,  sub: "need support",                bg: "from-red-500 to-rose-600",       cat: "Not Developed" },
          { label: "STP WIP",       value: wipCount,     sub: "in training / pending eval",  bg: "from-violet-500 to-purple-600",  cat: "STP WIP"       },
        ] as { label: string; value: number; sub: string; bg: string; cat: FilterOption }[]).map((kpi) => (
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

      {/* Upcoming Joinings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-sm flex-shrink-0">
            <UserPlus size={14} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Upcoming Joinings</h2>
            <p className="text-[11px] text-gray-400">Synced from Outlook</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {joinings !== null && (
              <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {joinings.length}
              </span>
            )}
            <button
              onClick={fetchJoinings}
              disabled={joiningsLoading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-40"
              title="Refresh from Outlook"
            >
              <svg className={`w-3.5 h-3.5 ${joiningsLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {joiningsError && (
          <div className="px-5 py-3 text-xs text-red-600 bg-red-50 border-b border-red-100">
            {joiningsError}
          </div>
        )}

        {/* Skeleton */}
        {joiningsLoading && !joinings && (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse h-9 bg-gray-100 rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {joinings && joinings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-3">
              <Calendar size={22} className="text-teal-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">No upcoming joinings found</p>
          </div>
        )}

        {/* Table */}
        {joinings && joinings.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">#</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Manager</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Country</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tentative DOJ</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Email Received</th>
                  <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {joinings.map((j, i) => {
                  const ini = j.name.split(" ").map(w => w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
                  const receivedDate = j.emailReceivedAt
                    ? new Date(j.emailReceivedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—";

                  const statusStyle =
                    j.status === "joined"      ? "bg-emerald-100 text-emerald-700 ring-emerald-200" :
                    j.status === "backed_out"  ? "bg-red-100 text-red-700 ring-red-200" :
                                                 "bg-amber-100 text-amber-700 ring-amber-200";
                  const statusLabel =
                    j.status === "joined"     ? "Joined" :
                    j.status === "backed_out" ? "Backed Out" : "Pending";

                  return (
                    <tr key={j.id} className={`hover:bg-gray-50 transition-colors ${j.status !== "pending" ? "opacity-60" : ""}`}>
                      <td className="py-2.5 px-4 text-xs text-gray-300">{i + 1}</td>

                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {ini}
                          </div>
                          <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">{j.name}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {j.manager || <span className="text-gray-300">—</span>}
                      </td>

                      <td className="py-2.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {j.country || <span className="text-gray-300">—</span>}
                      </td>

                      <td className="py-2.5 px-4 text-xs text-gray-700 font-medium whitespace-nowrap">
                        {j.tentativeDoj || <span className="text-gray-300 font-normal">—</span>}
                      </td>

                      <td className="py-2.5 px-4 text-xs text-gray-400 whitespace-nowrap">
                        {receivedDate}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block text-[10px] font-semibold px-2 py-1 rounded-lg ring-1 ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => updateJoiningStatus(j.id, j.status === "joined" ? "pending" : "joined")}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                              j.status === "joined"
                                ? "bg-emerald-600 text-white ring-1 ring-emerald-700"
                                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                            }`}
                          >
                            {j.status === "joined" ? "✓ Joined" : "Mark Joined"}
                          </button>
                          <button
                            onClick={() => updateJoiningStatus(j.id, j.status === "backed_out" ? "pending" : "backed_out")}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                              j.status === "backed_out"
                                ? "bg-red-600 text-white ring-1 ring-red-700"
                                : "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                            }`}
                          >
                            {j.status === "backed_out" ? "✗ Backed Out" : "Backed Out"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts Panel */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
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
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }} formatter={(val, name) => [`${val} CSMs`, name]} />
                  <Legend iconType="circle" iconSize={9} formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tenure Distribution</h3>
            <p className="text-[11px] text-gray-400 mb-3">{filteredNJs.length} CSM{filteredNJs.length !== 1 ? "s" : ""} in current view</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenureBarData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }} formatter={(val) => [`${val} CSMs`, "Count"]} cursor={{ fill: "#f9fafb" }} />
                  <Bar dataKey="count" fill="#a5b4fc" radius={[5, 5, 0, 0]}>
                    <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#6b7280" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phase Breakdown</h3>
            <p className="text-[11px] text-gray-400 mb-3">Current training phase distribution</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseBarData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }} formatter={(val) => [`${val} CSMs`, "Count"]} cursor={{ fill: "#f9fafb" }} />
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

      {/* Table + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-400 transition-all bg-gray-50">
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input type="text" placeholder="Search by name, Emp ID or manager…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none" />
              {search && <button onClick={() => setSearch("")}><X size={14} className="text-gray-400 hover:text-gray-600" /></button>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {FILTER_OPTIONS.map((opt) => (
                  <button key={opt} onClick={() => setCategoryFilter(opt)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1 ${
                      categoryFilter === opt
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}>
                    {opt}
                    <span className={`text-[10px] ${categoryFilter === opt ? "text-white/70" : "text-gray-400"}`}>
                      {categoryCounts[opt]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <UserCircle2 size={13} className="text-gray-400" />
                <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}
                  className="text-[11px] font-medium border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all max-w-[180px] truncate">
                  <option value="All">All Managers</option>
                  {managerList.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {managerFilter !== "All" && (
                  <button onClick={() => setManagerFilter("All")} className="text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

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
                  {filteredNJs.map((nj: NJ) => {
                    const isSelected = selectedNJId === nj.id;
                    const hasAlert   = (alerts?.some((a: PerformanceAlert) => a.njId === nj.id)) ?? false;
                    const displayCat = getDisplayCategory(nj);
                    const catStyle   = CATEGORY_STYLE[displayCat];
                    return (
                      <tr key={nj.id}
                        onClick={() => setSelectedNJId(isSelected ? null : nj.id)}
                        className={`cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${
                          isSelected ? "bg-indigo-50" : nj.isActive ? "hover:bg-gray-50" : "bg-gray-50/60 hover:bg-gray-100/60"
                        }`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              nj.isActive ? "bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-sm" : "bg-gray-200 text-gray-400"
                            }`}>
                              {initials(nj.name)}
                            </div>
                            {hasAlert && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />}
                            <button onClick={(e) => { e.stopPropagation(); setModalNJ(nj); }}
                              className={`font-medium text-left hover:text-indigo-600 hover:underline transition-colors ${nj.isActive ? "text-gray-900" : "text-gray-400"}`}>
                              {nj.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{nj.empId ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${catStyle}`}>
                              {displayCat}
                            </span>
                            {nj.stpExtendedDays > 0 && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                                +{nj.stpExtendedDays}d extended
                              </span>
                            )}
                          </div>
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
              <div className={`rounded-2xl p-5 text-white shadow-lg ${selectedNJ.isActive ? "bg-gradient-to-br from-indigo-600 to-violet-700" : "bg-gradient-to-br from-gray-500 to-gray-600"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-base font-bold flex-shrink-0">
                    {initials(selectedNJ.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-snug">{selectedNJ.name}</h3>
                    {selectedNJ.designation && <p className="text-white/70 text-xs mt-0.5">{selectedNJ.designation}</p>}
                    <p className="text-white/50 text-xs mt-1">Joined {fmtDOJ(selectedNJ.joinDate)} · {fmtTenure(selectedNJ.joinDate)}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">{selectedNJ.currentPhase}</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">{getDisplayCategory(selectedNJ)}</span>
                  {selectedNJ.stpExtendedDays > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-400/80 text-white text-xs font-semibold">
                      STP extended by {selectedNJ.stpExtendedDays} day{selectedNJ.stpExtendedDays > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Profile</p>
                </div>
                <div className="grid grid-cols-2 gap-px bg-gray-100">
                  {([
                    { icon: <Hash size={12} />,         label: "Emp ID",     value: selectedNJ.empId },
                    { icon: <UserCircle2 size={12} />,  label: "Manager",    value: selectedNJ.managerId },
                    { icon: <MapPin size={12} />,       label: "Location",   value: selectedNJ.location },
                    { icon: <Building2 size={12} />,    label: "Department", value: selectedNJ.department },
                    { icon: <Mail size={12} />,         label: "Email",      value: selectedNJ.email },
                    { icon: <CalendarDays size={12} />, label: "DOJ",        value: fmtDOJ(selectedNJ.joinDate) },
                  ] as { icon: React.ReactNode; label: string; value: string | null | undefined }[]).map(({ icon, label, value }) => (
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
                    <DayTaskTracker
                      huddleStatus={isInHuddleWindow ? huddleStatus : undefined}
                      dsrStatus={dsrMap.has(selectedNJ.id) ? "done" : "pending"}
                    />
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

      {modalNJ && <NJDetailModal nj={modalNJ} onClose={() => setModalNJ(null)} />}
    </div>
  );
}
