"use client";
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { fmtTenure } from "@/lib/formatTenure";
import type { NJ, RCBRow } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}₹${Math.abs(v).toLocaleString("en-IN")}`;
}

function fmtAxisINR(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${sign}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)      return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs}`;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function yearAgoISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { name: string; value: number } }[];
}) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 mb-1">{name}</p>
      <p className="text-gray-500">NR from Corporates</p>
      <p className={`text-base font-bold tabular-nums ${value >= 0 ? "text-indigo-600" : "text-red-600"}`}>
        {fmtINR(value)}
      </p>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RCBPage() {
  const [rows, setRows] = useState<RCBRow[] | null>(null);
  const [njs, setNjs] = useState<NJ[] | null>(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("All");
  const [startDate, setStartDate] = useState(yearAgoISO);
  const [endDate, setEndDate] = useState(todayISO);

  // ── Custom date-range overlay ──────────────────────────────────────────────
  const [customMap, setCustomMap] = useState<Map<string, { claimedCorporates: number; nrFromCorporates: number }> | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeRange, setActiveRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    fetch("/api/rcb?mode=summary")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setRows(data); });
    fetch("/api/nj")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNjs(data); });
  }, []);

  if (!rows) return <div className="animate-pulse h-96 bg-white/60 rounded-2xl" />;

  const isGarbageId = (id: string) => id.length >= 25 && !/\s/.test(id) && /^[a-zA-Z0-9]+$/.test(id);
  const managerList = [...new Set((njs ?? []).map(n => n.managerId).filter(
    (m): m is string => Boolean(m) && !isGarbageId(m)
  ))].sort();
  const njManagerMap = new Map((njs ?? []).map(n => [n.id, n.managerId]));

  // ── Merge custom data if a date-range fetch is active ─────────────────────
  const displayRows: RCBRow[] = rows.map((row) => {
    if (!customMap || !row.empId) return row;
    const hit = customMap.get(row.empId);
    if (!hit) return { ...row, claimedCorporates: 0, nrFromCorporates: 0 };
    return { ...row, claimedCorporates: hit.claimedCorporates, nrFromCorporates: hit.nrFromCorporates };
  });

  const sorted = [...displayRows]
    .filter(r => managerFilter === "All" || njManagerMap.get(r.id) === managerFilter)
    .sort((a, b) => b.joinDate.localeCompare(a.joinDate));

  // ── Search filter ──────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = q ? sorted.filter((r) => r.name.toLowerCase().includes(q)) : sorted;

  // ── Summaries (based on full sorted set, not filtered) ────────────────────
  const totalClaimed   = sorted.reduce((s, r) => s + r.claimedCorporates, 0);
  const totalNR        = sorted.reduce((s, r) => s + r.nrFromCorporates, 0);
  const csmsWithData   = sorted.filter((r) => r.claimedCorporates > 0).length;

  // ── Chart (CSMs with claims, sorted desc by NR) ───────────────────────────
  const chartData = sorted
    .filter((r) => r.claimedCorporates > 0)
    .sort((a, b) => b.nrFromCorporates - a.nrFromCorporates)
    .map((r) => ({
      name: r.name,
      label: r.name.split(" ").map((w, i) => (i === 0 ? w : w[0] + ".")).join(" "),
      value: r.nrFromCorporates,
    }));

  const chartHeight = Math.max(260, chartData.length * 34 + 60);

  // ── Date-range apply / reset ──────────────────────────────────────────────
  async function handleApply() {
    if (!startDate || !endDate || isFetching) return;
    setIsFetching(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/rcb?mode=range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (!res.ok) throw new Error("Failed to fetch range data");
      const result = await res.json();
      const map = new Map<string, { claimedCorporates: number; nrFromCorporates: number }>();
      for (const r of result) map.set(r.empId, { claimedCorporates: r.claimedCorporates, nrFromCorporates: r.nrFromCorporates });
      setCustomMap(map);
      setActiveRange({ start: startDate, end: endDate });
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setIsFetching(false);
    }
  }

  function handleReset() {
    setCustomMap(null);
    setActiveRange(null);
    setFetchError(null);
    setStartDate(yearAgoISO());
    setEndDate(todayISO());
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">RCB — Regular Corporate Business</h1>
        <p className="text-sm text-gray-500 mt-0.5">Claimed Corporates &amp; NR from Corporates per CSM · Recent joiners first</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 stagger">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">CSMs with Corporate Claims</div>
          <div className="text-4xl font-black">{csmsWithData}</div>
          <div className="text-xs text-white/60 mt-1">of {sorted.length} active CSMs</div>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Total Claimed Corporates</div>
          <div className="text-4xl font-black">{totalClaimed}</div>
          <div className="text-xs text-white/60 mt-1">Across all CSMs</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Total NR from Corporates</div>
          <div className="text-xl font-black tabular-nums leading-tight mt-1">{fmtINR(totalNR)}</div>
          <div className="text-xs text-white/60 mt-1">Combined corporate NR</div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">

        {/* Search + Manager filter */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
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
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
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

        {/* Date range toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-gray-500 font-medium">Date range:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 transition-colors"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 transition-colors"
            />
            <button
              onClick={handleApply}
              disabled={isFetching || !startDate || !endDate}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1.5"
            >
              {isFetching && (
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
              )}
              {isFetching ? "Fetching…" : "Apply"}
            </button>
            {activeRange && (
              <button
                onClick={handleReset}
                className="text-xs px-2.5 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {fetchError && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {fetchError}
          </div>
        )}

        {/* Active range indicator */}
        {activeRange && !fetchError && (
          <div className="mb-3 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              {activeRange.start} → {activeRange.end}
            </span>
          </div>
        )}

        {/* Table header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">CSM Corporate Breakdown</h2>
          <span className="text-xs text-gray-400">
            {filtered.length} of {sorted.length} CSMs
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b-2 border-gray-100 bg-gray-50/90 backdrop-blur-sm">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 w-8">#</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">CSM Name</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">Tenure</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400">Claimed Corporates</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400">NR from Corporates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-gray-400">
                    No CSMs match &ldquo;{search}&rdquo;
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm">
                          {row.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 group-hover:text-gray-900">{row.name}</p>
                          {row.designation && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{row.designation}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{fmtTenure(row.joinDate)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {row.claimedCorporates > 0 ? (
                        <span className="text-xs font-bold text-gray-800 tabular-nums">
                          {row.claimedCorporates}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {row.nrFromCorporates > 0 ? (
                        <span className="text-sm font-bold tabular-nums text-gray-900">
                          {fmtINR(row.nrFromCorporates)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-0.5">NR from Corporates — by CSM</h2>
          <p className="text-xs text-gray-400 mb-4">
            Only CSMs with claimed corporates · Sorted highest first · Hover for exact values
          </p>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 100, bottom: 4, left: 140 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={fmtAxisINR}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#374151" }}
                  width={136}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f0f4ff" }} />
                <ReferenceLine x={0} stroke="#e5e7eb" strokeWidth={1.5} />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  barSize={22}
                  label={{
                    position: "right",
                    formatter: (v: unknown) => fmtAxisINR(v as number),
                    fontSize: 10,
                    fill: "#6b7280",
                  }}
                >
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.value >= 0 ? "#6366f1" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
