"use client";
import { useState, useEffect, useCallback, Fragment } from "react";
import { useQuery, useAction, useConvexAuth } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import {
  PieChart, Pie, Cell, Legend, ResponsiveContainer, Sector,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";

// ─── date helpers ────────────────────────────────────────────────────────────

const MONTHS_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/** YYYY-MM-DD → DD-MMM-YYYY (Koenig API format) */
function toApiDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}-${MONTHS_ABBR[parseInt(month, 10) - 1]}-${year}`;
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

function fmtDOJ(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2,"0")} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── name matching (handles "Full Name-ShortName" API format) ────────────────

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function normCCECandidates(cce: string): string[] {
  const base = normName(cce);
  const candidates = new Set<string>();
  candidates.add(base);

  const hyphenIdx = base.lastIndexOf("-");
  const stripped = (hyphenIdx > 0 && base.slice(0, hyphenIdx).trim().includes(" "))
    ? base.slice(0, hyphenIdx).trim()
    : null;
  if (stripped) candidates.add(stripped);

  function firstLast(s: string): string | null {
    const words = s.split(/\s+/).filter(Boolean);
    return words.length >= 3 ? `${words[0]} ${words[words.length - 1]}` : null;
  }
  const flBase     = firstLast(base);
  const flStripped = stripped ? firstLast(stripped) : null;
  if (flBase)     candidates.add(flBase);
  if (flStripped) candidates.add(flStripped);

  return [...candidates];
}

// ─── session cache ────────────────────────────────────────────────────────────

interface ROICache { rows: FlatRow[]; fromDate: string; toDate: string; }
const ROI_CACHE_KEY = "stp_roi_cache";

function readROICache(): ROICache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ROI_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ROICache) : null;
  } catch { return null; }
}

function writeROICache(c: ROICache) {
  try { sessionStorage.setItem(ROI_CACHE_KEY, JSON.stringify(c)); } catch {}
}

// ─── row types ───────────────────────────────────────────────────────────────

interface RawApiRow {
  Leads?: number;
  ROI?: number;
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
    cce:          String(cce).trim().replace(/\s+/g, " "),
    leads:        Number(r.Leads ?? 0),
    registration: regVal !== null ? Number(regVal) : null,
    roi:          Number(r.ROI ?? 0),
  };
}

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

// ─── per-CSM detail chart ─────────────────────────────────────────────────────

function CSMChart({ row, dbRoi }: { row: FlatRow; dbRoi: number | null }) {
  const convRate = row.registration !== null && row.leads > 0
    ? parseFloat(((row.registration / row.leads) * 100).toFixed(1))
    : null;

  const countData = [
    { name: "Leads Allocated", value: row.leads,               fill: "#a5b4fc" },
    { name: "Registration",    value: row.registration ?? 0,   fill: "#86efac" },
  ];
  const roiVal  = dbRoi ?? 0;
  const roiData = [
    { name: "ROI", value: roiVal, fill: roiVal >= 0 ? "#86efac" : "#fca5a5" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">
        {row.cce} — Performance Overview
      </h2>
      <p className="text-xs text-gray-400 mb-5">Leads, Registration, Conversion Rate &amp; ROI</p>

      {/* 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Leads Allocated", value: row.leads,                                color: "bg-indigo-50 text-indigo-700 border-indigo-100"  },
          { label: "Registration",    value: row.registration ?? "—",                  color: "bg-green-50 text-green-700 border-green-100"     },
          { label: "Conversion Rate", value: convRate !== null ? `${convRate}%` : "—", color: "bg-amber-50 text-amber-700 border-amber-100"     },
          { label: "ROI",        value: dbRoi !== null ? fmtNumber(dbRoi) : "—",  color: roiVal >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <div className="text-xs font-medium opacity-70 mb-1">{c.label}</div>
            <div className="text-2xl font-black break-all">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-2">Leads &amp; Registration</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }} cursor={{ fill: "#f9fafb" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {countData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 700, fill: "#6b7280" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-2">ROI</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roiData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                  tickFormatter={v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  formatter={(val) => [fmtNumber(Number(val)), "ROI"]}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  cursor={{ fill: "#f9fafb" }}
                />
                <Bar dataKey="value" fill={roiVal >= 0 ? "#86efac" : "#fca5a5"} radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="value"
                    formatter={(v: unknown) => fmtNumber(Number(v))}
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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ROIPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const fetchROI  = useAction(api.actions.koenigApi.getROIData);
  const njs        = useQuery(api.queries.newJoiners.list, {});
  const defaultRows = useQuery(api.queries.roi.currentROISummary);

  const [fromInput,   setFromInput]   = useState(thirtyDaysAgo);
  const [toInput,     setToInput]     = useState(todayIso);
  const [allRows,     setAllRows]     = useState<FlatRow[] | null>(null);

  // Load cached rows after mount — avoids SSR/client mismatch
  useEffect(() => {
    const cached = readROICache();
    if (cached) setAllRows(cached.rows);
  }, []);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [nameSearch,   setNameSearch]   = useState("");
  const [selectedCSM,  setSelectedCSM]  = useState<string | null>(null);
  const [activeIdx,    setActiveIdx]    = useState(0);

  // ── NJ name sets ──────────────────────────────────────────────────────────
  const njNameSet = new Set<string>();
  for (const n of (njs ?? [])) {
    const base = normName(n.name);
    njNameSet.add(base);
    const words = base.split(/\s+/).filter(Boolean);
    if (words.length >= 3) njNameSet.add(`${words[0]} ${words[words.length - 1]}`);
  }

  const njMeta = new Map(
    (njs ?? []).map((n: Doc<"newJoiners">) => [
      normName(n.name),
      { joinDate: n.joinDate, tenureMonths: n.tenureMonths, designation: n.designation },
    ])
  );

  function getRowMeta(cce: string) {
    for (const candidate of normCCECandidates(cce)) {
      const m = njMeta.get(candidate);
      if (m) return m;
    }
    return undefined;
  }

  // ── DB NR totals (never changes with date filter) ─────────────────────────
  const dbNRMap = new Map<string, number | null>();
  for (const r of (defaultRows ?? [])) {
    dbNRMap.set(normName(r.name), r.totalNR ?? null);
  }

  function getDbROI(cce: string): number | null {
    for (const candidate of normCCECandidates(cce)) {
      if (dbNRMap.has(candidate)) return dbNRMap.get(candidate)!;
    }
    return null;
  }

  // ── Filtered + sorted rows ────────────────────────────────────────────────
  const matchedRows = allRows !== null && njs !== undefined
    ? (njNameSet.size > 0
        ? allRows.filter(r => normCCECandidates(r.cce).some(n => njNameSet.has(n)))
        : allRows)
    : null;

  const matchedNormNames = new Set(
    (matchedRows ?? []).flatMap(r => normCCECandidates(r.cce))
  );
  const zeroRows: FlatRow[] = (njs ?? [])
    .filter((n: Doc<"newJoiners">) => !matchedNormNames.has(normName(n.name)))
    .map((n: Doc<"newJoiners">) => ({ cce: n.name, leads: 0, registration: null, roi: 0 }));

  const rows = matchedRows ? [...matchedRows, ...zeroRows] : null;

  const tableRows = rows
    ? [...rows]
        .filter(r => !nameSearch || r.cce.toLowerCase().includes(nameSearch.toLowerCase()))
        .sort((a, b) => {
          const aDate = getRowMeta(a.cce)?.joinDate ?? "";
          const bDate = getRowMeta(b.cce)?.joinDate ?? "";
          if (bDate !== aDate) return bDate > aDate ? 1 : -1;
          return b.roi - a.roi;
        })
    : [];

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const doFetch = useCallback(async (from: string, to: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out — please try again")), 30_000)
      );
      const result = await Promise.race([
        fetchROI({ from_date: toApiDate(from), to_date: toApiDate(to), display_column: "CCE" }),
        timeout,
      ]);
      if (result?.statuscode !== 200) {
        setError(result?.message ?? "API returned a non-200 status");
        setAllRows(null);
        return;
      }
      const raw: RawApiRow[] = Array.isArray(result.content) ? result.content : [];
      const flatRows = raw.map(flattenRow);
      writeROICache({ rows: flatRows, fromDate: from, toDate: to });
      setAllRows(flatRows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setAllRows(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchROI]);

  // Auto-fetch once auth is confirmed ready
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      doFetch(fromInput, toInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  // ── Stat cards from DB ────────────────────────────────────────────────────
  const withNR         = (defaultRows ?? []).filter(r => r.totalNR !== null);
  const totalPositive  = withNR.filter(r => r.totalNR! > 0).length;
  const positiveWithin4 = withNR.filter(r => r.totalNR! > 0 && r.tenureMonths <= 4).length;
  const negativeWithin4 = withNR.filter(r => r.totalNR! < 0 && r.tenureMonths <= 4).length;
  const negativeBeyond4 = withNR.filter(r => r.totalNR! < 0 && r.tenureMonths > 4).length;
  const totalNegative  = withNR.filter(r => r.totalNR! < 0).length;

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

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ROI &amp; Leads</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Live data from Koenig API · {rows ? `${rows.length} CSMs` : "Loading…"}
        </p>
      </div>

      {/* Date-range search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">From</label>
            <input type="date" value={fromInput} max={toInput}
              onChange={e => setFromInput(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">To</label>
            <input type="date" value={toInput} min={fromInput}
              onChange={e => setToInput(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            onClick={() => doFetch(fromInput, toInput)}
            disabled={isLoading || !fromInput || !toInput}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            )}
            {isLoading ? "Loading…" : "Search"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {/* Stat cards (DB) */}
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

      {/* Total Leads Allocated — from live API */}
      {rows && (
        <div className="bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Total Leads Allocated</div>
          <div className="text-4xl font-black">{rows.reduce((s, r) => s + r.leads, 0)}</div>
          <div className="text-xs text-white/50 mt-1">{fromInput} → {toInput}</div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">CSM ROI Breakdown</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{fromInput} – {toInput}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search name…"
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
                className="text-xs pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white placeholder-gray-400 w-40"
              />
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Positive</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Negative</span>
            </div>
          </div>
        </div>

        {isLoading && !rows && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse h-9 bg-gray-100 rounded-lg" />
            ))}
          </div>
        )}

        {rows !== null && (
          <div className="overflow-x-auto">
            {isLoading && (
              <div className="h-1 w-full rounded-full bg-indigo-100 mb-3 overflow-hidden">
                <div className="h-1 bg-indigo-400 animate-[pulse_1s_ease-in-out_infinite] w-1/2 rounded-full" />
              </div>
            )}
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 w-8">#</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400">CSM Name</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400">DOJ</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400">Tenure</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Leads</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Registrations</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">Conv. Rate</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400">ROI</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-gray-400">
                      No records found for the selected date range
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row, i) => {
                    const meta = getRowMeta(row.cce);
                    const convRate = row.registration !== null && row.leads > 0
                      ? ((row.registration / row.leads) * 100).toFixed(1)
                      : null;
                    const dbRoi     = getDbROI(row.cce);
                    const isPositive = (dbRoi ?? 0) > 0;
                    const isNegative = (dbRoi ?? 0) < 0;
                    const isSelected = selectedCSM === row.cce;
                    return (
                      <Fragment key={row.cce + "-" + i}>
                        <tr className={`transition-colors group cursor-pointer ${isSelected ? "bg-indigo-50 hover:bg-indigo-50" : "hover:bg-gray-50"}`}
                          onClick={() => setSelectedCSM(isSelected ? null : row.cce)}>
                          <td className="py-2.5 px-3 text-xs text-gray-300">{i + 1}</td>
                          <td className="py-2.5 px-3">
                            <p className={`text-xs font-semibold group-hover:text-indigo-700 ${isSelected ? "text-indigo-700" : "text-gray-800"}`}>{row.cce}</p>
                            {meta?.designation && (
                              <p className="text-[10px] text-gray-400 mt-0.5">{meta.designation}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                            {meta?.joinDate ? fmtDOJ(meta.joinDate) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                            {meta?.tenureMonths !== undefined ? fmtTenure(meta.tenureMonths) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">{row.leads}</td>
                          <td className="py-2.5 px-3 text-right text-xs text-gray-500 tabular-nums">
                            {row.registration !== null ? row.registration : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-amber-600 font-semibold tabular-nums">
                            {convRate !== null ? `${convRate}%` : <span className="text-gray-300 font-normal">—</span>}
                          </td>
                          <td className={`py-2.5 px-3 text-right text-sm font-bold tabular-nums ${isPositive ? "text-amber-500" : isNegative ? "text-red-600" : "text-gray-900"}`}>
                            {dbRoi !== null ? fmtNumber(dbRoi) : <span className="text-gray-300 text-xs font-normal">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ${isPositive ? "bg-amber-50 text-amber-700 ring-amber-200/60" : isNegative ? "bg-red-100 text-red-700 ring-red-200/60" : "bg-gray-100 text-gray-500 ring-gray-200/60"}`}>
                              {isPositive ? "Positive" : isNegative ? "Negative" : "Zero"}
                            </span>
                          </td>
                        </tr>
                        {isSelected && (
                          <tr>
                            <td colSpan={9} className="px-3 pb-4 pt-1 bg-indigo-50">
                              <CSMChart row={row} dbRoi={dbRoi} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pie chart (DB) */}
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
                  cx="50%" cy="50%"
                  innerRadius={72} outerRadius={108}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIdx(index)}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="white" strokeWidth={3} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle" iconSize={10}
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
