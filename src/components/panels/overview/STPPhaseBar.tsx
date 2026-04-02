"use client";

import { clsx } from "clsx";

function workingDaysSince(dojISO: string): number {
  const doj = new Date(dojISO);
  doj.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(doj);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

interface STPPhaseBarProps {
  joinDate: string;
  stpExtendedDays: number;
  stpClosed: boolean | null;
}

export function STPPhaseBar({ joinDate, stpExtendedDays, stpClosed }: STPPhaseBarProps) {
  const wds     = workingDaysSince(joinDate);
  const maxDays = 14 + (stpExtendedDays > 0 ? 4 : 0); // 14 standard or up to 18 with extension

  // Status label
  let statusLabel = "";
  let statusStyle = "";
  if (stpClosed) {
    statusLabel = "STP Closed";
    statusStyle = "bg-gray-100 text-gray-500 border-gray-200";
  } else if (wds <= 14) {
    statusLabel = `Phase 1 — Training · Day ${wds} of 14`;
    statusStyle = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (wds <= 18) {
    statusLabel = `Phase 2 — Extended · Day ${wds} of 18`;
    statusStyle = "bg-amber-50 text-amber-700 border-amber-200";
  } else {
    statusLabel = "STP Window Complete";
    statusStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  // Day dots — show all 14 standard days, plus extended if applicable
  const standardDays  = Array.from({ length: 14 }, (_, i) => i + 1);
  const extendedDays  = stpExtendedDays > 0 ? Array.from({ length: 4 }, (_, i) => i + 15) : [];

  function dayState(day: number): "completed" | "today" | "upcoming" {
    if (stpClosed || day < wds) return "completed";
    if (day === wds) return "today";
    return "upcoming";
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">STP Phase Progress</p>
        <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full border", statusStyle)}>
          {statusLabel}
        </span>
      </div>

      {/* Standard days 1–14 */}
      <div className="mb-1">
        <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-1.5">Phase 1 — Standard (Days 1–14)</p>
        <div className="flex flex-wrap gap-1">
          {standardDays.map((day) => {
            const state = dayState(day);
            return (
              <div
                key={day}
                title={`Day ${day}`}
                className={clsx(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all",
                  state === "completed" && "bg-blue-500 border-blue-500 text-white",
                  state === "today"     && "bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-300 scale-110",
                  state === "upcoming"  && "bg-gray-50 border-gray-200 text-gray-400"
                )}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Extended days 15–18 (only shown if extension exists) */}
      {extendedDays.length > 0 && (
        <div className="mt-2">
          <p className="text-[9px] text-amber-500 font-medium uppercase tracking-wider mb-1.5">Phase 2 — Extended (Days 15–18)</p>
          <div className="flex flex-wrap gap-1">
            {extendedDays.map((day) => {
              const state = dayState(day);
              return (
                <div
                  key={day}
                  title={`Day ${day}`}
                  className={clsx(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all",
                    state === "completed" && "bg-amber-500 border-amber-500 text-white",
                    state === "today"     && "bg-amber-600 border-amber-600 text-white ring-2 ring-amber-300 scale-110",
                    state === "upcoming"  && "bg-amber-50 border-amber-200 text-amber-400"
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[9px] text-gray-400 mb-1">
          <span>Day 1</span>
          <span>{Math.min(wds, maxDays)} / {maxDays} days</span>
          <span>Day {maxDays}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-500",
              wds <= 14 ? "bg-blue-400" : "bg-amber-400"
            )}
            style={{ width: `${Math.min((wds / maxDays) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
