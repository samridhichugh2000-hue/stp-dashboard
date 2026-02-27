"use client";
import { useState, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Sector } from "recharts";

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** YYYY-MM-DD  →  DD-MMM-YYYY  (API format) */
function toApiDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}-${MONTHS[parseInt(month, 10) - 1]}-${year}`;
}

/** DD-MMM-YYYY  →  YYYY-MM-DD  (input[type=date] value) */
function fromApiDate(apiDate: string): string {
  const [day, mon, year] = apiDate.split("-");
  const m = String(MONTHS.indexOf(mon) + 1).padStart(2, "0");
  return `${year}-${m}-${String(day).padStart(2, "0")}`;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function startOfYearIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}

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

// ─── active pie shape ────────────────────────────────────────────────────────

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

// ─── types ───────────────────────────────────────────────────────────────────

type SearchRow = {
  cceName: string;
  leads: number;
  registrations: number;
  conversionRate: number;
  roiValue: number;
  fromDate: string;
  toDate: string;
};

// ─── page ────────────────────────────────────────────────────────────────────

export default function ROIPage() {
  const [activeIdx, setActiveIdx] = useState(0);

  // date-range inputs (YYYY-MM-DD for input[type=date])
  const [fromInput, setFromInput] = useState(startOfYearIso);
  const [toInput, setToInput]     = useState(todayIso);

  // search state
  const [searchRows, setSearchRows]   = useState<SearchRow[] | null>(null);
  const [searchLabel, setSearchLabel] = useState<{ from: string; to: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const defaultRows = useQuery(api.queries.roi.currentROISummary);
  const runSearch   = useAction(api.actions.searchROI.searchROI);

  // Pre-fill date inputs from existing data on first load
  const existingDateRange = useMemo(() => {
    if (!defaultRows) return null;
    const first = defaultRows.find(r => r.fromDate);
    if (!first) return null;
    return { from: first.fromDate!, to: first.toDate! };
  }, [defaultRows]);

  // Sync inputs once data loads (only if user hasn't typed yet)
  useMemo(() => {
    if (existingDateRange && fromInput === startOfYearIso() && toInput === todayIso()) {
      setFromInput(fromApiDate(existingDateRange.from));
      setToInput(fromApiDate(existingDateRange.to));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDateRange]);

  async function handleSearch() {
    if (!fromInput || !toInput) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const from = toApiDate(fromInput);
      const to   = toApiDate(toInput);
      const results = await runSearch({ fromDate: from, toDate: to });
      setSearchRows(results as SearchRow[]);
      setSearchLabel({ from, to });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }

  function handleClear() {
    setSearchRows(null);
    setSearchLabel(null);
    setSearchError(null);
  }

  // ── decide what rows to display ──────────────────────────────────────────

  const isShowingSearch = searchRows !== null;

  // For stat cards / pie — use default DB data regardless of search state
  if (!defaultRows) return <div className="animate-pulse h-96 bg-white/60 rounded-2xl" />;

  const withNR        = defaultRows.filter(r => r.totalNR !== null);
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

  const defaultHasLiveData = defaultRows.some(r => r.leads !== null);

  // Header subtitle
  const periodLabel = isShowingSearch
    ? `${searchLabel!.from} – ${searchLabel!.to}`
    : existingDateRange
    ? `${existingDateRange.from} – ${existingDateRange.to}`
    : "Current total net revenue per CSM";

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ROI Status of CSMs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Period: {periodLabel}</p>
      </div>

      {/* ── Date-range search bar ───────────────────────────────────────── */}
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
            disabled={isSearching || !fromInput || !toInput}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSearching ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            )}
            {isSearching ? "Searching…" : "Search"}
          </button>

          {isShowingSearch && (
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
            >
              Clear
            </button>
          )}
        </div>

        {searchError && (
          <p className="mt-2 text-xs text-red-500">{searchError}</p>
        )}

        {isShowingSearch && (
          <p className="mt-2 text-xs text-indigo-500 font-medium">
            Showing search results — {searchRows!.length} record{searchRows!.length !== 1 ? "s" : ""} found
          </p>
        )}
      </div>

      {/* ── Stat cards (always from DB / last sync) ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {statCards.map(c => (
          <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}>
            <div className="text-xs font-medium text-white/70 mb-2">{c.label}</div>
            <div className="text-4xl font-black">{c.count}</div>
            <div className="text-xs text-white/60 mt-1">{c.desc}</div>
          </div>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">CSM ROI Breakdown</h2>
            {isShowingSearch && (
              <p className="text-[11px] text-indigo-400 mt-0.5">
                Search results for {searchLabel!.from} – {searchLabel!.to}
              </p>
            )}
          </div>
          <div className="flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Negative</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* ── Search results table ── */}
          {isShowingSearch ? (
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
                {searchRows!.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                      No records found for the selected date range
                    </td>
                  </tr>
                ) : (
                  searchRows!.map((row, i) => {
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
          ) : (
            /* ── Default (last-sync) table ── */
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 w-8">#</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400">CSM Name</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400">Tenure</th>
                  {defaultHasLiveData && (
                    <>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Leads</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Registrations</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Conv. Rate</th>
                    </>
                  )}
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {defaultRows.map((row, i) => {
                  if (row.totalNR === null) {
                    return (
                      <tr key={row._id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <p className="text-xs font-medium text-gray-600">{row.name}</p>
                          {row.designation && <p className="text-[10px] text-gray-400 mt-0.5">{row.designation}</p>}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-400">{fmtTenure(row.tenureMonths)}</td>
                        {defaultHasLiveData && (
                          <>
                            <td className="py-2.5 px-3 text-right text-xs text-gray-300">—</td>
                            <td className="py-2.5 px-3 text-right text-xs text-gray-300">—</td>
                            <td className="py-2.5 px-3 text-right text-xs text-gray-300">—</td>
                          </>
                        )}
                        <td className="py-2.5 px-3 text-right text-xs text-gray-300">—</td>
                      </tr>
                    );
                  }
                  const code = colorOf(row.totalNR);
                  return (
                    <tr key={row._id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="text-xs font-semibold text-gray-800 group-hover:text-gray-900">{row.name}</p>
                        {row.designation && <p className="text-[10px] text-gray-400 mt-0.5">{row.designation}</p>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-400">{fmtTenure(row.tenureMonths)}</td>
                      {defaultHasLiveData && (
                        <>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">
                            {row.leads ?? "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">
                            {row.registrations ?? "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">
                            {row.conversionRate !== null ? `${row.conversionRate.toFixed(2)}%` : "—"}
                          </td>
                        </>
                      )}
                      <td className={`py-2.5 px-3 text-right text-sm font-bold tabular-nums ${NUM_COLOR[code]}`}>
                        {fmtNumber(row.totalNR)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Pie chart (always from DB) ──────────────────────────────────── */}
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

    </div>
  );
}
