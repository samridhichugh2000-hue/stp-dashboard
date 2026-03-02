"use client";
import { useState, useTransition } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/../convex/_generated/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

function fmtAxisINR(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${sign}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)      return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs}`;
}

function fmtTenure(months: number): string {
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yr} yr ${mo} mo` : `${yr} yr`;
}

function isoToday(): string {
  return new Date().toISOString().split("T")[0];
}

function isoYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number } }[] }) => {
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
  const rows = useQuery(api.queries.rcb.allCorpSummary);
  const fetchRCBForRange = useAction(api.actions.syncRCBFromAPI.getRCBForRange);

  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(isoYearAgo);
  const [endDate, setEndDate] = useState(isoToday);
  const [customData, setCustomData] = useState<Map<string, { claimedCorporates: number; nrFromCorporates: number }> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!rows) return <div className="animate-pulse h-96 bg-white/60 rounded-2xl" />;

  // ── Merge custom (date-range) data onto base rows ──────────────────────────
  const mergedRows = rows.map((row) => {
    if (!customData || !row.empId) return row;
    const override = customData.get(row.empId);
    if (!override) return { ...row, claimedCorporates: 0, nrFromCorporates: 0 };
    return { ...row, claimedCorporates: override.claimedCorporates, nrFromCorporates: override.nrFromCorporates };
  });

  // ── Sort: recent joiners first (ascending tenureMonths) ────────────────────
  const sortedRows = [...mergedRows].sort((a, b) => a.tenureMonths - b.tenureMonths);

  // ── Search filter ──────────────────────────────────────────────────────────
  const filteredRows = search.trim()
    ? sortedRows.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : sortedRows;

  // ── Summary cards (based on full sorted set, not filtered) ─────────────────
  const totalClaimed = sortedRows.reduce((s, r) => s + r.claimedCorporates, 0);
  const totalNR = sortedRows.reduce((s, r) => s + r.nrFromCorporates, 0);
  const csmsWithData = sortedRows.filter(r => r.claimedCorporates > 0).length;

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = sortedRows
    .filter(r => r.claimedCorporates > 0)
    .sort((a, b) => b.nrFromCorporates - a.nrFromCorporates)
    .map(r => ({
      name: r.name,
      label: r.name.split(" ").map((w, i) => i === 0 ? w : w[0] + ".").join(" "),
      value: r.nrFromCorporates,
    }));

  const chartHeight = Math.max(260, chartData.length * 34 + 60);

  // ── Date range apply ───────────────────────────────────────────────────────
  function applyDateRange() {
    if (!startDate || !endDate) return;
    setFetchError(null);
    startTransition(async () => {
      try {
        const result = await fetchRCBForRange({ startDate, endDate });
        const map = new Map<string, { claimedCorporates: number; nrFromCorporates: number }>();
        for (const r of result) map.set(r.empId, { claimedCorporates: r.claimedCorporates, nrFromCorporates: r.nrFromCorporates });
        setCustomData(map);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Failed to fetch data");
      }
    });
  }

  function resetDateRange() {
    setStartDate(isoYearAgo());
    setEndDate(isoToday());
    setCustomData(null);
    setFetchError(null);
  }

  const isCustomRange = customData !== null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">RCB - Regular Corporate Business</h1>
        <p className="text-sm text-gray-500 mt-0.5">Claimed Corporates &amp; NR from Corporates per CSM</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 stagger">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">CSMs with Corporate Claims</div>
          <div className="text-4xl font-black">{csmsWithData}</div>
          <div className="text-xs text-white/60 mt-1">Active CSMs</div>
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search CSM…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white placeholder-gray-400 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white text-gray-700 transition-colors"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white text-gray-700 transition-colors"
            />
            <button
              onClick={applyDateRange}
              disabled={isPending || !startDate || !endDate}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isPending ? "Fetching…" : "Apply"}
            </button>
            {isCustomRange && (
              <button
                onClick={resetDateRange}
                className="text-xs px-2.5 py-1.5 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {fetchError && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {fetchError}
          </div>
        )}

        {/* Custom range badge */}
        {isCustomRange && !fetchError && (
          <div className="mb-3 flex items-center gap-1.5 text-xs text-indigo-600">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
            Showing data for {startDate} → {endDate}
          </div>
        )}

        {/* Table header label */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">CSM Corporate Breakdown</h2>
          <span className="text-xs text-gray-400">Recent joiners first · {filteredRows.length} CSMs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 w-8">#</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">CSM Name</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">Tenure</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400">Claimed Corporates</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400">NR from Corporates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-gray-400">No CSMs match your search</td>
                </tr>
              ) : (
                filteredRows.map((row, i) => (
                  <tr key={row._id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-gray-900">{row.name}</p>
                      {row.designation && <p className="text-[10px] text-gray-400 mt-0.5">{row.designation}</p>}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{fmtTenure(row.tenureMonths)}</td>
                    <td className="py-2.5 px-3 text-right text-xs font-bold text-gray-800 tabular-nums">
                      {row.claimedCorporates}
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm font-bold tabular-nums text-gray-900">
                      {fmtINR(row.nrFromCorporates)}
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
          <p className="text-xs text-gray-400 mb-4">Only CSMs with claimed corporates · Sorted highest first · Hover for exact values</p>
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
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22} label={{
                  position: "right",
                  formatter: (v: unknown) => fmtAxisINR(v as number),
                  fontSize: 10,
                  fill: "#6b7280",
                }}>
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
