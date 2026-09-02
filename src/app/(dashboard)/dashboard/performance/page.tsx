"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";
import {
  PieChart, Pie, Cell, Legend, ResponsiveContainer, Sector,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import { fmtTenure } from "@/lib/formatTenure";
import { PipBadge } from "@/components/shared/PipBadge";
import type { PerformanceRow, NJ, PerformanceAlert } from "@/lib/types";
import { AlertCentre } from "@/components/panels/performance/AlertCentre";

type NRROIStatus = "Positive" | "Negative" | null;

// Pastel palette — green, red, black only
const P_GREEN = { bg: "bg-green-100",  text: "text-green-700",  ring: "ring-green-200/60"  };
const P_RED   = { bg: "bg-red-100",    text: "text-red-700",    ring: "ring-red-200/60"    };
const P_BLACK = { bg: "bg-gray-100",   text: "text-gray-700",   ring: "ring-gray-200/60"   };

// Hex fills for charts
const C_GREEN = "#86efac";   // green-300
const C_RED   = "#fca5a5";   // red-300


function computeAction(dev: boolean | null, tenure: number): string {
  if (dev === null) return "Under Observation";
  if (dev) return "On Track";
  return tenure >= 4 ? "PA/PIP Suggested" : "Under Observation";
}

function Pill({ label, palette }: { label: string; palette: typeof P_GREEN }) {
  return (
    <span className={clsx(
      "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap ring-1",
      palette.bg, palette.text, palette.ring
    )}>
      {label}
    </span>
  );
}

function NRROIBadge({ status }: { status: NRROIStatus }) {
  if (!status) return <span className="text-gray-300 text-xs select-none">—</span>;
  return <Pill label={status} palette={status === "Positive" ? P_GREEN : P_RED} />;
}

function NRStatusBadge({ status, positiveMonth }: { status: NRROIStatus; positiveMonth: number | null }) {
  if (!status) return <span className="text-gray-300 text-xs select-none">—</span>;
  if (positiveMonth !== null) {
    return <Pill label={`Positive within ${positiveMonth} mo`} palette={P_GREEN} />;
  }
  return <Pill label={status} palette={status === "Positive" ? P_GREEN : P_RED} />;
}

function StatusBadge({ dev, joinDate }: { dev: boolean | null; joinDate: string }) {
  if (dev === null) return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <Pill label="Pending Evaluation" palette={P_BLACK} />
      <span className="text-[10px] text-gray-400">tenure &lt; 4 months</span>
    </div>
  );
  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <Pill label={dev ? "Developed" : "Not Developed"} palette={dev ? P_GREEN : P_RED} />
      <span className="text-[10px] text-gray-400">within {fmtTenure(joinDate)}</span>
    </div>
  );
}

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-gray-300 text-xs select-none">—</span>;
  const palette =
    action === "On Track"          ? P_GREEN :
    action === "PA/PIP Suggested"  ? P_RED   : P_BLACK;
  return <Pill label={action} palette={palette} />;
}

const renderActiveShape = (props: Record<string, number & string>) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 18} textAnchor="middle" fill="#374151" fontSize={13} fontWeight="600">
        {(payload as unknown as { name: string }).name}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#111827" fontSize={26} fontWeight="800">
        {value as unknown as number}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#9ca3af" fontSize={12}>
        {`${((percent as unknown as number) * 100).toFixed(1)}% of CSMs`}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={(outerRadius as unknown as number) + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={(outerRadius as unknown as number) + 10}
        outerRadius={(outerRadius as unknown as number) + 14}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function PerformancePage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("All");
  const [rows, setRows] = useState<PerformanceRow[] | null>(null);
  const [njs, setNjs] = useState<NJ[] | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  type Tab = "alerts" | "charts" | "table";
  const [activeTab, setActiveTab] = useState<Tab>("charts");

  useEffect(() => {
    fetch("/api/performance")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setRows(data); });
    fetch("/api/nj")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNjs(data); });
    fetch("/api/performance-alerts")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data)) setAlerts(data); });
  }, []);

  const pendingAlertCount = alerts.filter(a => !a.acknowledgedAt).length;

  const isGarbageId = (id: string) =>
    id.length >= 25 && !/\s/.test(id) && /^[a-zA-Z0-9]+$/.test(id);
  const managerList = [...new Set((njs ?? []).map(n => n.managerId).filter(
    (m): m is string => Boolean(m) && !isGarbageId(m)
  ))].sort();
  const njManagerMap = new Map((njs ?? []).map(n => [n.id, n.managerId]));

  // Only keep rows whose NJ ID exists in the filtered njs list (removes garbage records)
  const validNJIds = new Set((njs ?? []).map(n => n.id));
  const enriched = rows?.filter(row => validNJIds.size === 0 || validNJIds.has(row.id)).map(row => {
    // New algo: Developed = tenure ≥ 4mo + positive ROI + not under PA/PIP
    // Pending (null) = tenure < 4mo (too early to evaluate)
    // Only treat PA/PIP as active if ToDate hasn't passed yet
    const pipActive = (() => {
      if (row.pipStatus !== "PA" && row.pipStatus !== "PIP") return false;
      if (!row.pipToDate) return true; // no end date — assume active
      const parsed = new Date(row.pipToDate); // handles "15 May 2026"
      return !isNaN(parsed.getTime()) ? parsed >= new Date() : true;
    })();
    const onPaPip = pipActive;
    const dev = row.tenureMonths < 4
      ? null
      : (row.roiStatus === "Positive" && !onPaPip) ? true : false;
    return {
      ...row,
      dev,
      suggestedAction: computeAction(dev, row.tenureMonths),
    };
  });

  const q = search.trim().toLowerCase();
  const filtered = enriched
    ?.filter(r => {
      const matchesSearch = !q || r.name.toLowerCase().includes(q);
      const matchesManager = managerFilter === "All" || njManagerMap.get(r.id) === managerFilter;
      return matchesSearch && matchesManager;
    })
    .sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());

  // ── Overall stat counts (always from full enriched set) ──────────────────
  const devCount    = enriched?.filter(r => r.dev === true).length  ?? 0;
  const notDevCount = enriched?.filter(r => r.dev === false).length ?? 0;
  const underObs    = enriched?.filter(r => r.suggestedAction === "Under Observation").length ?? 0;
  const pipCount    = enriched?.filter(r => r.suggestedAction === "PA/PIP Suggested").length ?? 0;

  const statCards = [
    { label: "Developed",         value: devCount,    desc: "4mo+, positive ROI, no PA/PIP", bg: "from-indigo-400 to-violet-500" },
    { label: "Not Developed",     value: notDevCount, desc: "4mo+, negative ROI or on PA/PIP", bg: "from-pink-400 to-rose-500" },
    { label: "Under Observation", value: underObs,    desc: "Under 4 months tenure",      bg: "from-purple-400 to-indigo-500" },
    { label: "PA/PIP Suggested",  value: pipCount,    desc: "Not developed, 4mo+",        bg: "from-rose-500 to-red-600" },
  ];

  // ── Chart data — all charts use `filtered` so they react to manager filter ─
  const chartRows = filtered ?? [];
  const chartLabel = managerFilter !== "All" ? managerFilter : "All CSMs";

  // Donut — Developed vs Not Developed (filtered)
  const fDevCount    = chartRows.filter(r => r.dev === true).length;
  const fNotDevCount = chartRows.filter(r => r.dev === false).length;
  const fWipCount    = chartRows.filter(r => r.dev === null).length;
  const pieData = [
    { name: "Developed",     value: fDevCount,    color: C_GREEN   },
    { name: "Not Developed", value: fNotDevCount, color: C_RED     },
    { name: "Pending Eval",  value: fWipCount,    color: "#c4b5fd" },
  ].filter(d => d.value > 0);

  // Grouped bar — Developed vs Not Developed by tenure (filtered)
  const tenureGroups = [
    { name: "≤ 2 mo", Developed: 0, "Not Developed": 0 },
    { name: "3–4 mo", Developed: 0, "Not Developed": 0 },
    { name: "> 4 mo", Developed: 0, "Not Developed": 0 },
  ];
  chartRows.forEach(r => {
    if (r.dev === null) return;
    const b = r.tenureMonths <= 2 ? 0 : r.tenureMonths <= 4 ? 1 : 2;
    if (r.dev) tenureGroups[b].Developed++;
    else tenureGroups[b]["Not Developed"]++;
  });

  // Bar — NR status breakdown (filtered)
  const nrBarData = [
    { name: "Positive NR", count: chartRows.filter(r => r.nrStatus === "Positive").length, fill: C_GREEN },
    { name: "Negative NR", count: chartRows.filter(r => r.nrStatus === "Negative").length, fill: C_RED   },
    { name: "No Data",     count: chartRows.filter(r => r.nrStatus === null).length,        fill: "#e5e7eb" },
  ].filter(d => d.count > 0);

  // Bar — Suggested action breakdown (filtered)
  const actionBarData = [
    { name: "On Track",         count: chartRows.filter(r => r.suggestedAction === "On Track").length,        fill: C_GREEN   },
    { name: "Under Obs.",       count: chartRows.filter(r => r.suggestedAction === "Under Observation").length, fill: "#c4b5fd" },
    { name: "PA/PIP",           count: chartRows.filter(r => r.suggestedAction === "PA/PIP Suggested").length,  fill: C_RED     },
    { name: "Pending",          count: chartRows.filter(r => r.suggestedAction === null).length,               fill: "#e5e7eb" },
  ].filter(d => d.count > 0);

  // Bar — Manager comparison (only when All managers)
  const managerCompData = managerFilter === "All"
    ? managerList.map(mgr => {
        const mRows = enriched?.filter(r => njManagerMap.get(r.id) === mgr) ?? [];
        const mDev = mRows.filter(r => r.dev === true).length;
        const mTotal = mRows.filter(r => r.dev !== null).length;
        return {
          name: mgr.split(" ")[0], // first name for brevity
          fullName: mgr,
          Developed: mDev,
          "Not Developed": mRows.filter(r => r.dev === false).length,
          total: mTotal,
          rate: mTotal > 0 ? Math.round(mDev / mTotal * 100) : 0,
        };
      }).filter(m => m.total > 0)
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NJ Performance Status</h1>
          <p className="text-sm text-gray-500 mt-0.5">Development status and suggested actions per CSM</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { key: "alerts", label: "Alert Centre",            badge: pendingAlertCount },
            { key: "charts", label: "Charts",                  badge: 0 },
            { key: "table",  label: "CSM Performance",         badge: 0 },
          ] as { key: Tab; label: string; badge: number }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={clsx(
                "relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards — always overall totals */}
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

      {/* Alert Centre tab */}
      {activeTab === "alerts" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Alert Centre</p>
            <p className="text-[10px] text-gray-400 mt-0.5">PA / PIP / Exit alerts requiring acknowledgement</p>
          </div>
          <div className="p-5">
            <AlertCentre />
          </div>
        </div>
      )}

      {/* ── Charts (react to manager filter) ──────────────────────────────────── */}
      {activeTab === "charts" && rows && (
        <>
          {/* Context label */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Charts</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {chartLabel} · {chartRows.length} CSM{chartRows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Row 1: Donut + Tenure grouped bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut — Developed / Not Developed / Pending */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Development Distribution</h2>
              <p className="text-xs text-gray-400 mb-2">{chartLabel} · hover to explore</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      {...{ activeIndex: activeIdx }}
                      activeShape={renderActiveShape as never}
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={88}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveIdx(index)}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="white" strokeWidth={3} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={10}
                      formatter={(value) => <span className="text-xs text-gray-600">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Grouped bar — Status by tenure bucket */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Status by Tenure Group</h2>
              <p className="text-xs text-gray-400 mb-2">{chartLabel} · Developed vs Not Developed</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenureGroups} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e5e7eb" }} cursor={{ fill: "#f9fafb" }} />
                    <Legend iconType="circle" iconSize={9}
                      formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
                    <Bar dataKey="Developed"     fill={C_GREEN} radius={[5, 5, 0, 0]} />
                    <Bar dataKey="Not Developed" fill={C_RED}   radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: NR Status + Suggested Action */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* NR Status bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">NR Status Breakdown</h2>
              <p className="text-xs text-gray-400 mb-2">{chartLabel} · Net Revenue signal</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nrBarData} margin={{ top: 16, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      formatter={(val) => [`${val} CSMs`, "Count"]} cursor={{ fill: "#f9fafb" }} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {nrBarData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700, fill: "#6b7280" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Suggested Action bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Suggested Actions</h2>
              <p className="text-xs text-gray-400 mb-2">{chartLabel} · recommended interventions</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actionBarData} margin={{ top: 16, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      formatter={(val) => [`${val} CSMs`, "Count"]} cursor={{ fill: "#f9fafb" }} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {actionBarData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700, fill: "#6b7280" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Manager comparison — only when All Managers */}
          {managerFilter === "All" && managerCompData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Manager-wise Performance</h2>
              <p className="text-xs text-gray-400 mb-4">Developed vs Not Developed per reporting manager</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={managerCompData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                      cursor={{ fill: "#f9fafb" }}
                    />
                    <Legend iconType="circle" iconSize={9}
                      formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
                    <Bar dataKey="Developed"     fill={C_GREEN} radius={[5, 5, 0, 0]} />
                    <Bar dataKey="Not Developed" fill={C_RED}   radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* Table */}
      {activeTab === "table" && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Search + Manager filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search CSM by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white placeholder-gray-400 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {/* Manager filter */}
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-300 transition-all">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <select
              value={managerFilter}
              onChange={e => setManagerFilter(e.target.value)}
              className="text-sm bg-transparent text-gray-600 focus:outline-none cursor-pointer"
            >
              <option value="All">All Managers</option>
              {managerList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {managerFilter !== "All" && (
              <button onClick={() => setManagerFilter("All")} className="text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          CSM Performance Breakdown
          {managerFilter !== "All" && (
            <span className="ml-2 text-xs font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
              {managerFilter} · {chartRows.length} CSMs
            </span>
          )}
        </h2>
        {rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b-2 border-gray-100 bg-gray-50/90 backdrop-blur-sm">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">CSM Name</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">Tenure</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">NR Status</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">ROI Status</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">Suggested Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered?.map((row, i) => (
                  <tr key={row.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm">
                          {row.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 group-hover:text-gray-900">{row.name}</p>
                          {row.designation && <p className="text-[10px] text-gray-400 mt-0.5">{row.designation}</p>}
                          <PipBadge pipStatus={row.pipStatus} pipFromDate={row.pipFromDate} pipToDate={row.pipToDate} className="mt-0.5" />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">{fmtTenure(row.joinDate)}</td>
                    <td className="py-2.5 px-3 text-center"><NRStatusBadge status={row.nrStatus} positiveMonth={row.nrPositiveMonth} /></td>
                    <td className="py-2.5 px-3 text-center"><NRROIBadge status={row.roiStatus} /></td>
                    <td className="py-2.5 px-3 text-center"><StatusBadge dev={row.dev} joinDate={row.joinDate} /></td>
                    <td className="py-2.5 px-3 text-center"><ActionBadge action={row.suggestedAction} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="animate-pulse h-64 bg-gray-50 rounded-xl" />
        )}
      </div>}

    </div>
  );
}
