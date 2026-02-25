"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import { clsx } from "clsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
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

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function fmtINR(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
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

  const regVal =
    r.Registration ?? r.Registrations ?? r.Reg ?? r.Registered ?? null;

  return {
    cce:          String(cce).trim(),
    leads:        Number(r.Leads ?? 0),
    registration: regVal !== null ? Number(regVal) : null,
    roi:          Number(r.ROI ?? 0),
  };
}

// ── Component ────────────────────────────────────────────────────
export default function LeadsPage() {
  const fetchROI = useAction(api.actions.koenigApi.getROIData);
  const njs      = useQuery(api.queries.newJoiners.list, {});

  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate,   setToDate]   = useState(todayISO());
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // All rows from API — unfiltered (filtering by NJ is reactive below)
  const [allRows, setAllRows] = useState<FlatRow[] | null>(null);

  // Reactive NJ name set — updates when Convex loads
  const njNameSet = new Set(
    (njs ?? []).map((n: Doc<"newJoiners">) => normName(n.name))
  );

  // Filter allRows against dashboard CSMs — reactive when njs arrives
  const rows = allRows
    ? (njNameSet.size > 0
        ? allRows.filter(r => njNameSet.has(normName(r.cce)))
        : allRows)
    : null;

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

      const content = result.content;
      const raw: RawApiRow[] = Array.isArray(content) ? content : [];
      setAllRows(raw.map(flattenRow));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setAllRows(null);
    } finally {
      setLoading(false);
    }
  }, [fetchROI]);

  // Auto-fetch on mount
  useEffect(() => {
    doFetch(fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when dates change
  function handleDateChange(newFrom: string, newTo: string) {
    doFetch(newFrom, newTo);
  }

  // Derived stats
  const totalLeads    = rows?.reduce((s, r) => s + r.leads, 0) ?? 0;
  const totalROI      = rows?.reduce((s, r) => s + r.roi,   0) ?? 0;
  const positiveCount = rows?.filter(r => r.roi > 0).length ?? 0;
  const negativeCount = rows?.filter(r => r.roi < 0).length ?? 0;

  const sorted = rows ? [...rows].sort((a, b) => b.leads - a.leads) : [];

  const chartData = sorted.map(r => ({
    name:     r.cce.split(" ")[0],
    fullName: r.cce,
    Leads:    r.leads,
    ROI:      r.roi,
  }));

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads / TAT</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live data from Koenig API · {rows ? `${rows.length} CSMs` : "Loading…"}
          </p>
        </div>
        {/* Manual refresh */}
        <button
          onClick={() => doFetch(fromDate, toDate)}
          disabled={loading}
          className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 active:scale-95 transition disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {/* Date range filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => {
                setFromDate(e.target.value);
                handleDateChange(e.target.value, toDate);
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => {
                setToDate(e.target.value);
                handleDateChange(fromDate, e.target.value);
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <p className="text-xs text-gray-400 self-end pb-2">
            Showing {toAPIDate(fromDate)} — {toAPIDate(toDate)}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4">
          <span className="font-semibold">Error: </span>{error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_,i) => (
              <div key={i} className="animate-pulse h-24 bg-white rounded-2xl border border-gray-100" />
            ))}
          </div>
          <div className="animate-pulse h-72 bg-white rounded-2xl border border-gray-100" />
          <div className="animate-pulse h-64 bg-white rounded-2xl border border-gray-100" />
        </div>
      )}

      {/* Results */}
      {!loading && rows && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
            {[
              { label: "Total Leads",       value: totalLeads,       bg: "from-indigo-400 to-violet-500" },
              { label: "Total ROI",         value: fmtINR(totalROI), bg: totalROI >= 0 ? "from-emerald-500 to-teal-600" : "from-red-500 to-rose-600" },
              { label: "Positive ROI CSMs", value: positiveCount,    bg: "from-amber-400 to-yellow-500" },
              { label: "Negative ROI CSMs", value: negativeCount,    bg: "from-slate-600 to-gray-700" },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}>
                <div className="text-xs font-medium text-white/70 mb-2">{c.label}</div>
                <div className="text-3xl font-black break-all">{c.value}</div>
              </div>
            ))}
          </div>

          {/* Leads bar chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Leads Allocated — by CSM</h2>
              <p className="text-xs text-gray-400 mb-4">{toAPIDate(fromDate)} to {toAPIDate(toDate)}</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 55 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }}
                      axisLine={false} tickLine={false} angle={-40} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(val, _name, props) => [val, props.payload.fullName]}
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                      cursor={{ fill: "#f9fafb" }}
                    />
                    <Bar dataKey="Leads" radius={[5,5,0,0]}>
                      {chartData.map((_, i) => <Cell key={i} fill="#a5b4fc" />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ROI bar chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">ROI — by CSM</h2>
              <p className="text-xs text-gray-400 mb-4">Pastel green = positive · Pastel red = negative</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 55 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }}
                      axisLine={false} tickLine={false} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 || v <= -1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      formatter={(val, _name, props) => [fmtINR(Number(val)), props.payload.fullName]}
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                      cursor={{ fill: "#f9fafb" }}
                    />
                    <Bar dataKey="ROI" radius={[5,5,0,0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.ROI >= 0 ? "#86efac" : "#fca5a5"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">CSM Breakdown</h2>
              <span className="text-xs text-gray-400">{sorted.length} CSMs</span>
            </div>

            {sorted.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No matching CSMs for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-8">#</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">CSM Name</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Leads Allocated</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Registration</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Conversion Rate</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">ROI</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">ROI Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sorted.map((row, i) => (
                      <tr key={row.cce} className="hover:bg-indigo-50/20 transition-colors group">
                        <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold text-gray-800 group-hover:text-gray-900">
                          {row.cce}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-indigo-600 tabular-nums">
                          {row.leads}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-gray-600 tabular-nums">
                          {row.registration !== null
                            ? row.registration
                            : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs font-semibold text-amber-600 tabular-nums">
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
                            row.roi > 0
                              ? "bg-green-100 text-green-700 ring-green-200/60"
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
