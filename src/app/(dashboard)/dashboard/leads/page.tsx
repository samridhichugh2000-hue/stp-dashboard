"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import { clsx } from "clsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from "recharts";

// ── Date helpers ────────────────────────────────────────────────
const MONTHS_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toAPIDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2,"0")}-${MONTHS_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

function lastOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,"0")}-${String(last.getDate()).padStart(2,"0")}`;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function fmtDOJ(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTenure(months: number): string {
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yr} yr ${mo} mo` : `${yr} yr`;
}

function fmtINR(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

function currentMonthLabel(): string {
  const d = new Date();
  return `${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Types ────────────────────────────────────────────────────────
interface RawApiRow {
  Leads?: number;
  ROI?: number;
  FromDate?: string;
  ToDate?: string;
  DisplayColumns?: { CCE?: string; [key: string]: unknown };
  [key: string]: unknown;
}

interface FlatRow {
  cce:          string;
  leads:        number;
  registration: number | null;
  roi:          number;
}

function flattenRow(r: RawApiRow): FlatRow {
  const cce =
    r.DisplayColumns?.CCE ??
    (typeof r.CCE === "string" ? r.CCE : "") ??
    String(Object.values(r.DisplayColumns ?? {})[0] ?? "Unknown");

  const regVal = r.Registration ?? r.Registrations ?? r.Reg ?? r.Registered ?? null;

  return {
    cce:          String(cce).trim(),
    leads:        Number(r.Leads ?? 0),
    registration: regVal !== null ? Number(regVal) : null,
    roi:          Number(r.ROI ?? 0),
  };
}

// ── Per-CSM chart ────────────────────────────────────────────────
function CSMChart({ row }: { row: FlatRow }) {
  const convRate = row.registration !== null && row.leads > 0
    ? parseFloat(((row.registration / row.leads) * 100).toFixed(1))
    : null;

  // Leads + Registration bars (count axis)
  const countData = [
    { name: "Leads Allocated", value: row.leads,               fill: "#a5b4fc" },
    { name: "Registration",    value: row.registration ?? 0,   fill: "#86efac" },
  ];

  // ROI bar (separate chart, large values)
  const roiData = [
    { name: "ROI", value: row.roi, fill: row.roi >= 0 ? "#86efac" : "#fca5a5" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">
        {row.cce} — Performance Overview
      </h2>
      <p className="text-xs text-gray-400 mb-5">Leads, Registration, Conversion Rate &amp; ROI</p>

      {/* 4 mini metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Leads Allocated", value: row.leads,                         color: "bg-indigo-50 text-indigo-700 border-indigo-100"  },
          { label: "Registration",    value: row.registration ?? "—",           color: "bg-green-50 text-green-700 border-green-100"    },
          { label: "Conversion Rate", value: convRate !== null ? `${convRate}%` : "—", color: "bg-amber-50 text-amber-700 border-amber-100" },
          { label: "ROI",             value: fmtINR(row.roi),                   color: row.roi >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100" },
        ].map(c => (
          <div key={c.label} className={clsx("rounded-xl border p-4", c.color)}>
            <div className="text-xs font-medium opacity-70 mb-1">{c.label}</div>
            <div className="text-2xl font-black break-all">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leads vs Registration */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Leads &amp; Registration</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  cursor={{ fill: "#f9fafb" }}
                />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {countData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 700, fill: "#6b7280" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROI */}
        <div>
          <p className="text-xs text-gray-400 mb-2">ROI</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roiData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 || v <= -1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  formatter={(val) => [fmtINR(Number(val)), "ROI"]}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  cursor={{ fill: "#f9fafb" }}
                />
                <Bar dataKey="value" fill={row.roi >= 0 ? "#86efac" : "#fca5a5"} radius={[6,6,0,0]}>
                  <LabelList dataKey="value"
                    formatter={(v: unknown) => fmtINR(Number(v))}
                    position="top"
                    style={{ fontSize: 11, fontWeight: 700, fill: "#6b7280" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function LeadsPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const fetchROI = useAction(api.actions.koenigApi.getROIData);
  const njs      = useQuery(api.queries.newJoiners.list, {});

  const [fromDate,   setFromDate]   = useState(firstOfMonth());
  const [toDate,     setToDate]     = useState(lastOfMonth());
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [allRows,    setAllRows]    = useState<FlatRow[] | null>(null);
  const [csmFilter,  setCsmFilter]  = useState<string>("all");

  const njNameSet = new Set(
    (njs ?? []).map((n: Doc<"newJoiners">) => normName(n.name))
  );

  // Lookup: normalized name → { joinDate, tenureMonths }
  const njMeta = new Map(
    (njs ?? []).map((n: Doc<"newJoiners">) => [
      normName(n.name),
      { joinDate: n.joinDate, tenureMonths: n.tenureMonths, designation: n.designation },
    ])
  );

  // Filter against dashboard CSMs — reactive
  const rows = allRows
    ? (njNameSet.size > 0
        ? allRows.filter(r => njNameSet.has(normName(r.cce)))
        : allRows)
    : null;

  // Selected CSM row
  const selectedRow = csmFilter !== "all" && rows
    ? rows.find(r => r.cce === csmFilter) ?? null
    : null;

  // Table rows: if CSM selected, show only that one
  const tableRows = rows
    ? (csmFilter === "all" ? [...rows].sort((a,b) => b.leads - a.leads) : rows.filter(r => r.cce === csmFilter))
    : [];

  const doFetch = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchROI({
        from_date: toAPIDate(from),
        to_date:   toAPIDate(to),
        display_column: "CCE",
      });
      if (result?.statuscode !== 200) {
        setError(result?.message ?? "API returned a non-200 status");
        setAllRows(null);
        return;
      }
      const raw: RawApiRow[] = Array.isArray(result.content) ? result.content : [];
      setAllRows(raw.map(flattenRow));
      setCsmFilter("all");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setAllRows(null);
    } finally {
      setLoading(false);
    }
  }, [fetchROI]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      doFetch(fromDate, toDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  // Stat card totals — always from ALL rows (full CSM set, not filtered by csmFilter)
  const totalLeads = rows?.reduce((s, r) => s + r.leads, 0) ?? 0;
  const totalROI   = rows?.reduce((s, r) => s + r.roi,   0) ?? 0;

  const csmList = rows ? [...new Set(rows.map(r => r.cce))].sort() : [];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live data from Koenig API · {rows ? `${rows.length} CSMs` : "Loading…"}
          </p>
        </div>
        <button
          onClick={() => doFetch(fromDate, toDate)}
          disabled={loading}
          className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 active:scale-95 transition disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
            <input type="date" value={fromDate}
              onChange={e => { setFromDate(e.target.value); doFetch(e.target.value, toDate); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
            <input type="date" value={toDate}
              onChange={e => { setToDate(e.target.value); doFetch(fromDate, e.target.value); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          {rows && csmList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">CSM</label>
              <select value={csmFilter} onChange={e => setCsmFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[200px]"
              >
                <option value="all">All CSMs</option>
                {csmList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4">
          <span className="font-semibold">Error: </span>{error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(2)].map((_,i) => (
              <div key={i} className="animate-pulse h-24 bg-white rounded-2xl border border-gray-100" />
            ))}
          </div>
          <div className="animate-pulse h-64 bg-white rounded-2xl border border-gray-100" />
        </div>
      )}

      {/* Results */}
      {!loading && rows && (
        <>
          {/* 2 stat cards — current month totals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl p-5 text-white shadow-lg card-hover">
              <div className="text-xs font-medium text-white/70 mb-1">Total Leads Allocated</div>
              <div className="text-4xl font-black">{totalLeads}</div>
              <div className="text-xs text-white/50 mt-1">{currentMonthLabel()}</div>
            </div>
            <div className={clsx(
              "bg-gradient-to-br rounded-2xl p-5 text-white shadow-lg card-hover",
              totalROI >= 0 ? "from-emerald-500 to-teal-600" : "from-red-500 to-rose-600"
            )}>
              <div className="text-xs font-medium text-white/70 mb-1">Total ROI Earned</div>
              <div className="text-3xl font-black break-all">{fmtINR(totalROI)}</div>
              <div className="text-xs text-white/50 mt-1">{currentMonthLabel()}</div>
            </div>
          </div>

          {/* Per-CSM chart — only when a CSM is selected */}
          {selectedRow && <CSMChart row={selectedRow} />}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                {csmFilter === "all" ? "All CSMs" : csmFilter}
              </h2>
              <span className="text-xs text-gray-400">{tableRows.length} CSM{tableRows.length !== 1 ? "s" : ""}</span>
            </div>
            {tableRows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-8">#</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">CSM Name</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">DOJ</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">Tenure</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Leads Allocated</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Registration</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Conversion Rate</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">ROI</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">ROI Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tableRows.map((row, i) => (
                      <tr
                        key={row.cce}
                        onClick={() => setCsmFilter(row.cce === csmFilter ? "all" : row.cce)}
                        className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                      >
                        <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <p className="text-xs font-semibold text-gray-800 group-hover:text-indigo-700">{row.cce}</p>
                          {njMeta.get(normName(row.cce))?.designation && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{njMeta.get(normName(row.cce))!.designation}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                          {njMeta.get(normName(row.cce))?.joinDate
                            ? fmtDOJ(njMeta.get(normName(row.cce))!.joinDate)
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                          {njMeta.get(normName(row.cce))?.tenureMonths !== undefined
                            ? fmtTenure(njMeta.get(normName(row.cce))!.tenureMonths)
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-indigo-600 tabular-nums">
                          {row.leads}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs tabular-nums text-gray-600 font-semibold">
                          {row.registration !== null ? row.registration : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs tabular-nums text-amber-600 font-semibold">
                          {row.registration !== null && row.leads > 0
                            ? `${((row.registration / row.leads) * 100).toFixed(1)}%`
                            : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                        <td className={clsx(
                          "py-2.5 px-3 text-right text-sm font-bold tabular-nums",
                          row.roi > 0 ? "text-emerald-600" : row.roi < 0 ? "text-red-600" : "text-gray-700"
                        )}>
                          {fmtINR(row.roi)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={clsx(
                            "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ring-1",
                            row.roi > 0 ? "bg-green-100 text-green-700 ring-green-200/60"
                                        : "bg-red-100 text-red-700 ring-red-200/60"
                          )}>
                            {row.roi > 0 ? "Positive" : "Negative"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
