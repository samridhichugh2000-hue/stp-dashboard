"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

// ── Date helpers ────────────────────────────────────────────────
const MONTHS_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "2026-01-01"  →  "01-Jan-2026" */
function toAPIDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2,"0")}-${MONTHS_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

/** First day of current month as ISO */
function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

/** Today as ISO */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── Types ────────────────────────────────────────────────────────
type ApiRow = Record<string, string | number | null>;

interface ParsedStats {
  totalLeads: number;
  totalReg: number;
  convRate: string;
  cceList: string[];
}

// Try to detect column names flexibly (API may vary capitalisation)
function findKey(row: ApiRow, candidates: string[]): string | undefined {
  const keys = Object.keys(row).map(k => k.toLowerCase());
  for (const c of candidates) {
    const idx = keys.indexOf(c.toLowerCase());
    if (idx !== -1) return Object.keys(row)[idx];
  }
  return undefined;
}

function parseStats(rows: ApiRow[]): ParsedStats {
  if (!rows.length) return { totalLeads: 0, totalReg: 0, convRate: "—", cceList: [] };

  const sample = rows[0];
  const leadsKey = findKey(sample, ["leads_allocated","leads","total_leads","leadsallocated","allocated"]);
  const regKey   = findKey(sample, ["registration","registrations","reg","registered"]);
  const cceKey   = findKey(sample, ["cce","cce_name","ccename","name","csm"]);

  let totalLeads = 0, totalReg = 0;
  const cceSet = new Set<string>();

  for (const r of rows) {
    if (leadsKey) totalLeads += Number(r[leadsKey] ?? 0);
    if (regKey)   totalReg   += Number(r[regKey]   ?? 0);
    if (cceKey && r[cceKey]) cceSet.add(String(r[cceKey]));
  }

  const convRate = totalLeads > 0
    ? `${((totalReg / totalLeads) * 100).toFixed(1)}%`
    : "—";

  return { totalLeads, totalReg, convRate, cceList: [...cceSet].sort() };
}

// ── Component ────────────────────────────────────────────────────
export default function LeadsPage() {
  const fetchROI = useAction(api.actions.koenigApi.getROIData);
  const njs      = useQuery(api.queries.newJoiners.list, {});

  // Normalised set of NJ names from the Google Sheet
  const njNameSet = new Set(
    (njs ?? []).map((n: Doc<"newJoiners">) => n.name.toLowerCase().trim())
  );

  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate,   setToDate]   = useState(todayISO());
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [rawData,  setRawData]  = useState<ApiRow[] | null>(null);
  const [cceFilter, setCceFilter] = useState<string>("all");

  async function handleFetch() {
    setLoading(true);
    setError(null);
    setRawData(null);
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
      const rows: ApiRow[] = Array.isArray(content)
        ? content
        : Array.isArray(content?.data)
          ? content.data
          : typeof content === "object" && content !== null
            ? [content]
            : [];

      // Keep only rows whose CCE name matches a CSM in our dashboard
      const cceKey = rows.length ? findKey(rows[0], ["cce","cce_name","ccename","name","csm"]) : undefined;
      const filtered = njNameSet.size > 0 && cceKey
        ? rows.filter(r => {
            const val = r[cceKey];
            return val && njNameSet.has(String(val).toLowerCase().trim());
          })
        : rows;

      setRawData(filtered);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Derived data
  const stats      = rawData ? parseStats(rawData) : null;
  const filtered   = rawData
    ? (cceFilter === "all"
        ? rawData
        : rawData.filter(r => {
            const k = findKey(r, ["cce","cce_name","ccename","name","csm"]);
            return k && String(r[k]) === cceFilter;
          }))
    : [];

  // Chart data — one bar per row / CCE
  const chartData = filtered.map(r => {
    const leadsKey = findKey(r, ["leads_allocated","leads","total_leads","leadsallocated","allocated"]);
    const regKey   = findKey(r, ["registration","registrations","reg","registered"]);
    const cceKey   = findKey(r, ["cce","cce_name","ccename","name","csm"]);
    const label    = cceKey ? String(r[cceKey] ?? "—").split(" ")[0] : "—"; // first word for brevity
    return {
      name:          label,
      Leads:         leadsKey ? Number(r[leadsKey] ?? 0) : 0,
      Registrations: regKey   ? Number(r[regKey]   ?? 0) : 0,
    };
  });

  // All column headers from the data (for the raw table)
  const columns = rawData?.length ? Object.keys(rawData[0]) : [];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads / TAT</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monthly leads, registrations and conversion rates from API</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          {stats && stats.cceList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">CSM / CCE</label>
              <select
                value={cceFilter}
                onChange={e => setCceFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="all">All CSMs</option>
                {stats.cceList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleFetch}
            disabled={loading}
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
      {!loading && rawData && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
            {[
              { label: "Total Leads",        value: stats?.totalLeads,  bg: "from-indigo-400 to-violet-500" },
              { label: "Total Registrations", value: stats?.totalReg,   bg: "from-emerald-500 to-teal-600"  },
              { label: "Conversion Rate",     value: stats?.convRate,   bg: "from-amber-400 to-yellow-500"  },
              { label: "Total CSMs",          value: stats?.cceList.length, bg: "from-blue-400 to-indigo-500" },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}>
                <div className="text-xs font-medium text-white/70 mb-2">{c.label}</div>
                <div className="text-4xl font-black">{c.value ?? <span className="text-white/40">—</span>}</div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Leads vs Registrations — by CSM</h2>
              <p className="text-xs text-gray-400 mb-4">
                {toAPIDate(fromDate)} to {toAPIDate(toDate)}
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false} tickLine={false}
                      angle={-35} textAnchor="end" interval={0}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                      cursor={{ fill: "#f9fafb" }}
                    />
                    <Legend
                      iconType="circle" iconSize={9}
                      formatter={v => <span className="text-xs text-gray-600">{v}</span>}
                    />
                    <Bar dataKey="Leads"         fill="#a5b4fc" radius={[5,5,0,0]} />
                    <Bar dataKey="Registrations" fill="#86efac" radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Data table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Detailed Breakdown
                {cceFilter !== "all" && (
                  <span className="ml-2 text-indigo-500 font-normal">— {cceFilter}</span>
                )}
              </h2>
              <span className="text-xs text-gray-400">{filtered.length} row{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data for the selected filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-500 w-8">#</th>
                      {columns.map(col => (
                        <th key={col} className="text-left py-2.5 px-3 font-semibold text-gray-500 whitespace-nowrap">
                          {col.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((row, i) => (
                      <tr key={i} className="hover:bg-indigo-50/20 transition-colors">
                        <td className="py-2.5 px-3 text-gray-300">{i + 1}</td>
                        {columns.map(col => {
                          const val = row[col];
                          // Highlight conversion-rate-like columns
                          const isRate = /rate|conv/i.test(col);
                          const isLeads = /leads|allocated/i.test(col);
                          const isReg   = /reg/i.test(col);
                          return (
                            <td key={col} className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                              {val === null || val === "" || val === undefined ? (
                                <span className="text-gray-300">—</span>
                              ) : isRate ? (
                                <span className="font-semibold text-amber-600">{val}</span>
                              ) : isLeads ? (
                                <span className="font-semibold text-indigo-600">{val}</span>
                              ) : isReg ? (
                                <span className="font-semibold text-emerald-600">{val}</span>
                              ) : (
                                <span className="text-gray-700">{String(val)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Raw count note */}
          {rawData.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              API returned no records for this date range.
            </p>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !rawData && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-semibold text-gray-700">Select a date range and click Fetch Data</p>
          <p className="text-xs text-gray-400 mt-1">Data is pulled live from the Koenig API</p>
        </div>
      )}

    </div>
  );
}
