"use client";
import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Sector } from "recharts";

// ─── date helpers ────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** YYYY-MM-DD → DD-MMM-YYYY (API format) */
function toApiDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}-${MONTHS[parseInt(month, 10) - 1]}-${year}`;
}

// ─── display helpers ─────────────────────────────────────────────────────────

function fmtNumber(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

function fmtTenure(months: number): string {
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yr} yr ${mo} mo` : `${yr} yr`;
}

function colorOf(v: number): "Positive" | "Negative" | "Zero" {
  if (v > 0) return "Positive";
  if (v < 0) return "Negative";
  return "Zero";
}

const NUM_COLOR = {
  Positive: "text-amber-500",
  Negative: "text-red-600",
  Zero:     "text-gray-900",
};

// ─── active pie shape ─────────────────────────────────────────────────────────

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

// ─── types ────────────────────────────────────────────────────────────────────

type SearchRow = {
  cceName: string;
  leads: number;
  registrations: number;
  conversionRate: number;
  roiValue: number;
  fromDate: string;
  toDate: string;
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ROIPage() {
  const [activeIdx, setActiveIdx] = useState(0);

  // Date range inputs (YYYY-MM-DD) — default to current month
  const [fromInput, setFromInput] = useState(firstDayOfMonth);
  const [toInput, setToInput]     = useState(todayIso);

  // Active table data (auto-loaded or searched)
  const [tableData, setTableData]     = useState<SearchRow[] | null>(null);
  const [activeLabel, setActiveLabel] = useState<{ from: string; to: string } | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // DB data for stat cards & pie (always reflects last sync)
  const defaultRows = useQuery(api.queries.roi.currentROISummary);
  const runSearch   = useAction(api.actions.searchROI.searchROI);

  // ── Auto-load current month on mount ──────────────────────────────────────
  useEffect(() => {
    const from = toApiDate(firstDayOfMonth());
    const to   = toApiDate(todayIso());
    setIsLoading(true);
    runSearch({ fromDate: from, toDate: to })
      .then((res) => {
        setTableData(res as SearchRow[]);
        setActiveLabel({ from, to });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load data"))
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Search handler ────────────────────────────────────────────────────────
  async function handleSearch() {
    if (!fromInput || !toInput) return;
    setIsLoading(true);
    setError(null);
    try {
      const from = toApiDate(fromInput);
      const to   = toApiDate(toInput);
      const res  = await runSearch({ fromDate: from, toDate: to });
      setTableData(res as SearchRow[]);
      setActiveLabel({ from, to });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Stat card values from DB ──────────────────────────────────────────────
  const withNR        = (defaultRows ?? []).filter(r => r.totalNR !== null);
  const totalPositive   = withNR.filter(r => r.totalNR! > 0).length;
  const positiveWithin4 = withNR.filter(r => r.totalNR! > 0 && r.tenureMonths <= 4).length;
  const negativeWithin4 = withNR.filter(r => r.totalNR! < 0 && r.tenureMonths <= 4).length;
  const negativeBeyond4 = withNR.filter(r => r.totalNR! < 0 && r.tenureMonths > 4).length;
  const totalNegative   = withNR.filter(r => r.totalNR! < 0).length;

  const pieData = [
    { name: "Positive", value: totalPositive, color: "#f59e0b" },
    { name: "Negative", value: totalNegative, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const statCards = [
    { label: "Total Positive ROI",  desc: "CSMs with positive ROI",         count: totalPositive,   bg: "from-amber-400 to-yellow-500" },
    { label: "Positive ROI ≤ 4 mo", desc: "New joiners already in positive", count: positiveWithin4, bg: "from-emerald-500 to-teal-600" },
    { label: "Negative ROI ≤ 4 mo", desc: "New joiners still developing",    count: negativeWithin4, bg: "from-orange-400 to-amber-600" },
    { label: "Negative ROI > 4 mo", desc: "CSMs yet to turn positive",       count: negativeBeyond4, bg: "from-red-500 to-rose-600" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ROI Status of CSMs</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {activeLabel
            ? `Showing: ${activeLabel.from} – ${activeLabel.to}`
            : "Loading current month data…"}
        </p>
      </div>

      {/* ── Date-range search bar ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">From</label>
            <input
              type="date"
              value={fromInput}
              max={toInput}
              onChange={e => setFromInput(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">To</label>
            <input
              type="date"
              value={toInput}
              min={fromInput}
              onChange={e => setToInput(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={isLoading || !fromInput || !toInput}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            )}
            {isLoading ? "Loading…" : "Search"}
          </button>
        </div>

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {/* ── Stat cards (from last DB sync) ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {!defaultRows
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse h-28 bg-gray-100 rounded-2xl" />
            ))
          : statCards.map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}>
                <div className="text-xs font-medium text-white/70 mb-2">{c.label}</div>
                <div className="text-4xl font-black">{c.count}</div>
                <div className="text-xs text-white/60 mt-1">{c.desc}</div>
              </div>
            ))
        }
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">CSM ROI Breakdown</h2>
            {activeLabel && (
              <p className="text-[11px] text-gray-400 mt-0.5">{activeLabel.from} – {activeLabel.to}</p>
            )}
          </div>
          <div className="flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Negative</span>
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && !tableData && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse h-9 bg-gray-100 rounded-lg" />
            ))}
          </div>
        )}

        {/* Table */}
        {(!isLoading || tableData) && (
          <div className={`overflow-x-auto transition-opacity ${isLoading ? "opacity-40 pointer-events-none" : ""}`}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 w-8">#</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400">CSM Name</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Leads</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Registrations</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Conv. Rate</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!tableData || tableData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                      No records found for the selected date range
                    </td>
                  </tr>
                ) : (
                  tableData.map((row, i) => {
                    const code = colorOf(row.roiValue);
                    return (
                      <tr key={row.cceName + i} className="hover:bg-gray-50 transition-colors group">
                        <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold text-gray-800 group-hover:text-gray-900">
                          {row.cceName}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">{row.leads}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">{row.registrations}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">
                          {row.conversionRate.toFixed(2)}%
                        </td>
                        <td className={`py-2.5 px-3 text-right text-sm font-bold tabular-nums ${NUM_COLOR[code]}`}>
                          {fmtNumber(row.roiValue)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pie chart (from last DB sync) ────────────────────────────────────── */}
      {defaultRows && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-0.5">ROI Distribution</h2>
          <p className="text-xs text-gray-400 mb-2">Hover over a segment to explore</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  {...({ activeIndex: activeIdx } as object)}
                  activeShape={renderActiveShape as never}
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={108}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIdx(index)}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="white" strokeWidth={3} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={10}
                  formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}
