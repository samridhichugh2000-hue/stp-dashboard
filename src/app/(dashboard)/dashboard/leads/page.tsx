"use client";

import { useState } from "react";
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

/** Collapse all whitespace runs to a single space and lowercase */
function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function fmtINR(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

// ── API row shape ────────────────────────────────────────────────
interface RawApiRow {
  Leads?: number;
  ROI?: number;
  FromDate?: string;
  ToDate?: string;
  DisplayColumns?: { CCE?: string; [key: string]: unknown };
  [key: string]: unknown;
}

interface FlatRow {
  cce:      string;
  leads:    number;
  roi:      number;
  fromDate: string;
  toDate:   string;
}

function flattenRow(r: RawApiRow): FlatRow {
  const cce = r.DisplayColumns?.CCE
    ?? (typeof r.CCE === "string" ? r.CCE : "")
    ?? String(Object.values(r.DisplayColumns ?? {})[0] ?? "Unknown");
  return {
    cce:      String(cce).trim(),
    leads:    Number(r.Leads  ?? 0),
    roi:      Number(r.ROI    ?? 0),
    fromDate: String(r.FromDate ?? ""),
    toDate:   String(r.ToDate   ?? ""),
  };
}

// ── Component ────────────────────────────────────────────────────
export default function LeadsPage() {
  const fetchROI = useAction(api.actions.koenigApi.getROIData);
  const njs      = useQuery(api.queries.newJoiners.list, {});

  const njNameSet = new Set(
    (njs ?? []).map((n: Doc<"newJoiners">) => normName(n.name))
  );

  const [fromDate,   setFromDate]   = useState(firstOfMonth());
  const [toDate,     setToDate]     = useState(todayISO());
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [rows,       setRows]       = useState<FlatRow[] | null>(null);
  const [cceFilter,  setCceFilter]  = useState<string>("all");

  async function handleFetch() {
    setLoading(true);
    setError(null);
    setRows(null);
    setCceFilter("all");
    try {
      const result = await fetchROI({
        from_date: toAPIDate(fromDate),
        to_date:   toAPIDate(toDate),
        display_column: "CCE",
      });

      if (result?.statuscode !== 200) {
        setError(result?.message ?? "API returned a non-200 status");
        return;
      }

      const content = result.content;
      const raw: RawApiRow[] = Array.isArray(content) ? content : [];

      // Flatten + filter to dashboard CSMs only
      const flat = raw
        .map(flattenRow)
        .filter(r =>
          njNameSet.size === 0 || njNameSet.has(normName(r.cce))
        );

      setRows(flat);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Derived
  const cceList     = rows ? [...new Set(rows.map(r => r.cce))].sort() : [];
  const filtered    = rows
    ? (cceFilter === "all" ? rows : rows.filter(r => r.cce === cceFilter))
    : [];

  const totalLeads    = filtered.reduce((s, r) => s + r.leads, 0);
  const totalROI      = filtered.reduce((s, r) => s + r.roi,   0);
  const positiveCount = filtered.filter(r => r.roi > 0).length;
  const negativeCount = filtered.filter(r => r.roi < 0).length;

  // Chart data — sorted by leads desc
  const chartData = [...filtered]
    .sort((a, b) => b.leads - a.leads)
    .map(r => ({
      name: r.cce.split(" ")[0],  // first name for brevity on axis
      fullName: r.cce,
      Leads: r.leads,
      ROI:   r.roi,
    }));

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads / TAT</h1>
        <p className="text-sm text-gray-500 mt-0.5">Leads and ROI from the Koenig API — filtered to dashboard CSMs</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
            <input
              type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
            <input
              type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          {rows && cceList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">CSM</label>
              <select
                value={cceFilter} onChange={e => setCceFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="all">All CSMs</option>
                {cceList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleFetch} disabled={loading}
            className="ml-auto px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Fetching…" : "Fetch Data"}
          </button>
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
        </div>
      )}

      {/* Results */}
      {!loading && rows && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
            {[
              { label: "Total Leads",      value: totalLeads,      bg: "from-indigo-400 to-violet-500" },
              { label: "Total ROI",        value: fmtINR(totalROI), bg: totalROI >= 0 ? "from-emerald-500 to-teal-600" : "from-red-500 to-rose-600" },
              { label: "Positive ROI CSMs", value: positiveCount,  bg: "from-amber-400 to-yellow-500"  },
              { label: "Negative ROI CSMs", value: negativeCount,  bg: "from-slate-600 to-gray-700"    },
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
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 50 }}>
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
                      {chartData.map((_, i) => (
                        <Cell key={i} fill="#a5b4fc" />
                      ))}
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
              <p className="text-xs text-gray-400 mb-4">Green = positive · Red = negative</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 50 }}>
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
              <h2 className="text-sm font-semibold text-gray-700">
                Detailed Breakdown
                {cceFilter !== "all" && <span className="ml-2 text-indigo-500 font-normal">— {cceFilter}</span>}
              </h2>
              <span className="text-xs text-gray-400">{filtered.length} CSM{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No matching CSMs found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-8">#</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">CSM Name</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Leads Allocated</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">ROI</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">ROI Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...filtered]
                      .sort((a, b) => b.leads - a.leads)
                      .map((row, i) => (
                        <tr key={row.cce} className="hover:bg-indigo-50/20 transition-colors group">
                          <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                          <td className="py-2.5 px-3 text-xs font-semibold text-gray-800 group-hover:text-gray-900">
                            {row.cce}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs font-semibold text-indigo-600 tabular-nums">
                            {row.leads}
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

          {rows.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No dashboard CSMs found in the API response for this date range.
            </p>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !rows && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-semibold text-gray-700">Select a date range and click Fetch Data</p>
          <p className="text-xs text-gray-400 mt-1">Data is pulled live from the Koenig API</p>
        </div>
      )}

    </div>
  );
}
