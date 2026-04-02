"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { Search, ChevronUp, ChevronDown } from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────────

interface WeekCell {
  roiValue: number;
  colorCode: string;
}

interface HeatmapRow {
  id:             number;
  name:           string;
  empId:          string;
  joinDate:       string;
  tenureMonths:   number;
  managerId:      string | null;
  weeks:          Record<string, WeekCell>;
  consecutiveRed: number;
}

interface HeatmapData {
  weeks: string[];
  rows:  HeatmapRow[];
}

// ── constants ──────────────────────────────────────────────────────────────────

const COLOR_CELL: Record<string, { bg: string; text: string; border: string }> = {
  Green:  { bg: "bg-emerald-100",  text: "text-emerald-800", border: "border-emerald-200" },
  Yellow: { bg: "bg-amber-100",    text: "text-amber-800",   border: "border-amber-200"   },
  Red:    { bg: "bg-red-100",      text: "text-red-700",     border: "border-red-200"     },
  Black:  { bg: "bg-gray-800",     text: "text-gray-100",    border: "border-gray-700"    },
};

const LEGEND = [
  { code: "Green",  label: "On track",        dot: "bg-emerald-500" },
  { code: "Yellow", label: "Needs attention", dot: "bg-amber-500"   },
  { code: "Red",    label: "At risk",         dot: "bg-red-500"     },
  { code: "Black",  label: "Critical",        dot: "bg-gray-800"    },
];

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function fmtJoin(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Only show last N weeks so the table doesn't overflow
const MAX_VISIBLE_WEEKS = 12;

// ── component ──────────────────────────────────────────────────────────────────

export function ROIHeatmap() {
  const [data,    setData]    = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [sortBy,  setSortBy]  = useState<"name" | "red">("red");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    fetch("/api/roi/heatmap")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData({ weeks: [], rows: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse h-8 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-xs text-gray-400">
        No ROI data available
      </div>
    );
  }

  // Visible weeks: last MAX_VISIBLE_WEEKS
  const visibleWeeks = data.weeks.slice(-MAX_VISIBLE_WEEKS);

  // Filter + sort
  const filtered = data.rows
    .filter(r =>
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.empId.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      if (sortBy === "red")  cmp = a.consecutiveRed - b.consecutiveRed;
      return sortDir === "desc" ? -cmp : cmp;
    });

  const toggleSort = (col: "name" | "red") => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: "name" | "red" }) => {
    if (sortBy !== col) return null;
    return sortDir === "asc"
      ? <ChevronUp size={11} className="inline ml-0.5" />
      : <ChevronDown size={11} className="inline ml-0.5" />;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or emp ID…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <span className="text-[10px] text-gray-400">
          {filtered.length} of {data.rows.length} NJs
        </span>
        {data.weeks.length > MAX_VISIBLE_WEEKS && (
          <span className="text-[10px] text-gray-400">
            Showing last {MAX_VISIBLE_WEEKS} of {data.weeks.length} weeks
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {LEGEND.map(l => (
          <span key={l.code} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className={clsx("w-2.5 h-2.5 rounded-full", l.dot)} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th
                className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none sticky left-0 bg-gray-50 z-10 min-w-[140px]"
                onClick={() => toggleSort("name")}
              >
                Name <SortIcon col="name" />
              </th>
              {visibleWeeks.map(w => (
                <th
                  key={w}
                  className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide min-w-[64px]"
                >
                  {fmtWeek(w)}
                </th>
              ))}
              <th
                className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none min-w-[80px]"
                onClick={() => toggleSort("red")}
              >
                Red Streak <SortIcon col="red" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(row => (
              <tr key={row.id} className="hover:bg-gray-50/70 transition-colors group">
                {/* NJ name cell */}
                <td className="px-3 py-2 sticky left-0 bg-white group-hover:bg-gray-50/70 z-10">
                  <div className="font-semibold text-gray-800 truncate max-w-[130px]" title={row.name}>
                    {row.name}
                  </div>
                  <div className="text-[10px] text-gray-400">{row.empId} · {fmtJoin(row.joinDate)}</div>
                </td>

                {/* Week cells */}
                {visibleWeeks.map(w => {
                  const cell = row.weeks[w];
                  if (!cell) {
                    return (
                      <td key={w} className="px-2 py-2 text-center">
                        <span className="text-gray-300 text-[11px]">—</span>
                      </td>
                    );
                  }
                  const style = COLOR_CELL[cell.colorCode] ?? {
                    bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200",
                  };
                  return (
                    <td key={w} className="px-2 py-2 text-center">
                      <span
                        className={clsx(
                          "inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border",
                          style.bg, style.text, style.border
                        )}
                        title={`${cell.colorCode} · ${cell.roiValue}%`}
                      >
                        {cell.roiValue}
                      </span>
                    </td>
                  );
                })}

                {/* Consecutive red streak */}
                <td className="px-3 py-2 text-center">
                  {row.consecutiveRed > 0 ? (
                    <span className={clsx(
                      "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full",
                      row.consecutiveRed >= 3
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    )}>
                      🔴 {row.consecutiveRed}w
                    </span>
                  ) : (
                    <span className="text-gray-300 text-[11px]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-400">
            No results match your search
          </div>
        )}
      </div>
    </div>
  );
}
