"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { fmtTenure } from "@/lib/formatTenure";
import type { PerformanceRow, NJ } from "@/lib/types";

type NRROIStatus = "Positive" | "Negative" | null;
type DevFilter = "all" | "developed" | "not-developed" | "no-data";

function computeDev(
  nrPositiveMonth: number | null,
  roiStatus: NRROIStatus,
  nrStatus: NRROIStatus
): boolean | null {
  if (!roiStatus && !nrStatus) return null;
  const nrPositive = nrPositiveMonth !== null || nrStatus === "Positive";
  return roiStatus === "Positive" && nrPositive;
}

function DevBadge({ dev }: { dev: boolean | null }) {
  if (dev === null)
    return (
      <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400 ring-1 ring-gray-200/60 whitespace-nowrap">
        No Data
      </span>
    );
  return (
    <span
      className={clsx(
        "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 whitespace-nowrap",
        dev
          ? "bg-green-100 text-green-700 ring-green-200/60"
          : "bg-red-100 text-red-700 ring-red-200/60"
      )}
    >
      {dev ? "Developed" : "Not Developed"}
    </span>
  );
}


export default function TargetPage() {
  const [managerFilter, setManagerFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [devFilter, setDevFilter] = useState<DevFilter>("all");

  const [rows, setRows] = useState<PerformanceRow[] | null>(null);
  const [njs, setNjs] = useState<NJ[] | null>(null);

  useEffect(() => {
    fetch("/api/performance")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setRows(data); });
    fetch("/api/nj")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNjs(data); });
  }, []);

  const njManagerMap  = new Map((njs ?? []).map((n) => [n.id, n.managerId]));
  const njJoinDateMap = new Map((njs ?? []).map((n) => [n.id, n.joinDate]));

  const enriched = rows?.map((row) => {
    const joinDate = njJoinDateMap.get(row.id) ?? (row as { joinDate?: string }).joinDate ?? "";
    const markDate = joinDate ? new Date(joinDate) : null;
    if (markDate) markDate.setMonth(markDate.getMonth() + 4);
    const fourMonthMark = markDate
      ? markDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })
      : "—";
    return {
      ...row,
      dev: computeDev(row.nrPositiveMonth, row.roiStatus, row.nrStatus),
      manager: njManagerMap.get(row.id) ?? "—",
      joinDate,
      fourMonthMark,
    };
  });

  // Q2 2026 target: only CSMs whose 4-month tenure mark falls in Apr–Jun 2026
  const Q2_START = new Date("2026-04-01");
  const Q2_END   = new Date("2026-06-30T23:59:59");
  const q2Base = enriched?.filter((r) => {
    const mark = new Date(r.joinDate);
    mark.setMonth(mark.getMonth() + 4);
    return mark >= Q2_START && mark <= Q2_END;
  });

  // Counts — Q2-eligible CSMs only
  const total        = q2Base?.length ?? 0;
  const devCount     = q2Base?.filter((r) => r.dev === true).length  ?? 0;
  const notDevCount  = q2Base?.filter((r) => r.dev === false).length ?? 0;
  const noDataCount  = q2Base?.filter((r) => r.dev === null).length  ?? 0;
  const pct = total > 0 ? Math.round((devCount / total) * 100) : 0;

  // Manager list — only managers with at least one Q2-eligible CSM
  const q2ManagerList = [
    ...new Set((q2Base ?? []).map((r) => r.manager).filter((m) => m !== "—")),
  ].sort();

  // Filtered rows for table (search + manager + dev-status filters on top of q1Base)
  const q = search.trim().toLowerCase();
  const filtered = q2Base?.filter((r) => {
    const matchesManager =
      managerFilter === "All" || r.manager === managerFilter;
    const matchesSearch = !q || r.name.toLowerCase().includes(q);
    const matchesDev =
      devFilter === "all"
        ? true
        : devFilter === "developed"
        ? r.dev === true
        : devFilter === "not-developed"
        ? r.dev === false
        : r.dev === null;
    return matchesManager && matchesSearch && matchesDev;
  })?.sort((a, b) => b.joinDate.localeCompare(a.joinDate));

  const statCards = [
    {
      label: "Q2 Scope",
      value: total,
      desc: "CSMs in 4-month window (Apr–Jun 2026)",
      bg: "from-cyan-400 to-blue-500",
    },
    {
      label: "Achieved",
      value: devCount,
      desc: "Developed (NR + ROI positive)",
      bg: "from-emerald-400 to-teal-500",
    },
    {
      label: "Gap",
      value: notDevCount,
      desc: "Not yet developed",
      bg: "from-rose-400 to-red-500",
    },
    {
      label: "Awaiting Data",
      value: noDataCount,
      desc: "No NR / ROI records yet",
      bg: "from-amber-400 to-orange-500",
    },
  ];

  const filterPills: { label: string; value: DevFilter; count: number }[] = [
    { label: "All", value: "all", count: total },
    { label: "Developed", value: "developed", count: devCount },
    { label: "Not Developed", value: "not-developed", count: notDevCount },
    { label: "No Data", value: "no-data", count: noDataCount },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Target Vs Achievement
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Q2 2026 · CSMs whose 4-month mark falls in Apr–Jun 2026
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Qualifying join window: Dec 2025 – Feb 2026
          </p>
        </div>
        {/* Manager filter */}
        <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm focus-within:ring-2 focus-within:ring-cyan-300 transition-all flex-shrink-0">
          <svg
            className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="text-sm bg-transparent text-gray-600 focus:outline-none cursor-pointer"
          >
            <option value="All">All Managers</option>
            {q2ManagerList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {managerFilter !== "All" && (
            <button
              onClick={() => setManagerFilter("All")}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Q2 progress banner */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-white/80">
              Q2 Development Progress
            </p>
            <p className="text-3xl font-black mt-1">
              {devCount}
              <span className="text-lg font-semibold text-white/70">
                {" "}
                / {total}
              </span>
              <span className="text-lg font-semibold text-white/70 ml-2">
                CSMs
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black">{pct}%</p>
            <p className="text-xs text-white/70 mt-0.5">Achievement Rate</p>
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
          <div
            className="bg-white rounded-full h-3 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-white/70">
          <span>{devCount} Developed</span>
          <span>·</span>
          <span>{notDevCount} Not Developed</span>
          <span>·</span>
          <span>{noDataCount} Awaiting Data</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {statCards.map((c) => (
          <div
            key={c.label}
            className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}
          >
            <div className="text-xs font-medium text-white/70 mb-2">
              {c.label}
            </div>
            <div className="text-4xl font-black">
              {rows ? c.value : <span className="text-white/40">—</span>}
            </div>
            <div className="text-xs text-white/60 mt-1">{c.desc}</div>
          </div>
        ))}
      </div>

      {/* CSM Detail Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search CSM…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white placeholder-gray-400 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterPills.map(({ label, value, count }) => (
              <button
                key={value}
                onClick={() => setDevFilter(value)}
                className={clsx(
                  "text-xs font-medium px-3 py-1.5 rounded-lg transition-all border",
                  devFilter === value
                    ? "bg-cyan-500 text-white border-cyan-500 shadow-sm"
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                )}
              >
                {label}{" "}
                <span
                  className={clsx(
                    "ml-1 font-bold",
                    devFilter === value ? "text-white/80" : "text-gray-400"
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          CSM Status Breakdown
          {filtered && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {filtered.length} CSMs
            </span>
          )}
        </h2>

        {rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-8">
                    #
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">
                    CSM Name
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">
                    Manager
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">
                    Current Tenure
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">
                    4-Mo Mark
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">
                    NR Status
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">
                    ROI Status
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">
                    Q2 Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered?.map((row, i) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50/60 transition-colors group"
                  >
                    <td className="py-2.5 px-3 text-xs text-gray-300">
                      {i + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-xs font-semibold text-gray-800 group-hover:text-gray-900">
                        {row.name}
                      </p>
                      {row.designation && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {row.designation}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">
                      {row.manager}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">
                      {fmtTenure(row.joinDate)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs font-medium text-indigo-600">
                      {row.fourMonthMark}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.nrStatus ? (
                        <span
                          className={clsx(
                            "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 whitespace-nowrap",
                            row.nrStatus === "Positive"
                              ? "bg-green-100 text-green-700 ring-green-200/60"
                              : "bg-red-100 text-red-700 ring-red-200/60"
                          )}
                        >
                          {row.nrPositiveMonth !== null
                            ? `+ve in ${row.nrPositiveMonth} mo`
                            : row.nrStatus}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.roiStatus ? (
                        <span
                          className={clsx(
                            "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 whitespace-nowrap",
                            row.roiStatus === "Positive"
                              ? "bg-green-100 text-green-700 ring-green-200/60"
                              : "bg-red-100 text-red-700 ring-red-200/60"
                          )}
                        >
                          {row.roiStatus}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <DevBadge dev={row.dev} />
                    </td>
                  </tr>
                ))}
                {filtered?.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-sm text-gray-400"
                    >
                      No CSMs match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="animate-pulse h-64 bg-gray-50 rounded-xl" />
        )}
      </div>
    </div>
  );
}
