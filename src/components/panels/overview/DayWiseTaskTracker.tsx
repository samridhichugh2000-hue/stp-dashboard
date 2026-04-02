"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { clsx } from "clsx";

// ── helpers ────────────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWorkingDayDate(joinDateISO: string, dayNum: number): string {
  // Parse as local date to avoid UTC offset shifting the date
  const [y, mo, da] = joinDateISO.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  let count = 0;
  while (count < dayNum) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return localISO(d);
}

function workingDaysSince(joinDateISO: string): number {
  const doj = new Date(joinDateISO);
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

type TaskStatus = "done" | "missed" | "upcoming";
type TaskKey    = "huddle" | "qubits" | "dsr";

interface Override { date: string; task: string; done: boolean; }

interface DayRow {
  day:     number;
  date:    string;
  huddle:  TaskStatus;
  qubits:  TaskStatus;
  dsr:     TaskStatus;
  isPast:  boolean;
  isToday: boolean;
}

const TASK_LABEL: Record<TaskKey, string> = {
  huddle: "Huddle",
  qubits: "Qubits",
  dsr:    "DSR",
};

// ── cell ───────────────────────────────────────────────────────────────────────

function TaskCell({
  status,
  canEdit,
  saving,
  onClick,
}: {
  status:   TaskStatus;
  canEdit:  boolean;
  saving:   boolean;
  onClick:  () => void;
}) {
  const base = clsx(
    "inline-flex items-center justify-center w-7 h-7 rounded-lg border text-[11px] font-bold transition-all",
    status === "done"     && "bg-emerald-100 text-emerald-700 border-emerald-200",
    status === "missed"   && "bg-red-100 text-red-500 border-red-200",
    status === "upcoming" && "bg-gray-50 text-gray-300 border-gray-100",
    canEdit && "cursor-pointer hover:scale-110 hover:shadow-sm",
    saving  && "opacity-50 cursor-not-allowed"
  );

  const icon = saving ? "…" : status === "done" ? "✓" : status === "missed" ? "✗" : "·";

  return (
    <button
      onClick={canEdit && !saving ? onClick : undefined}
      disabled={!canEdit || saving}
      title={canEdit ? (status === "done" ? "Click to mark missed" : "Click to mark done") : undefined}
      className={base}
    >
      {icon}
    </button>
  );
}

// ── component ──────────────────────────────────────────────────────────────────

interface Props { njId: number; joinDate: string; }

export function DayWiseTaskTracker({ njId, joinDate }: Props) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [huddleDates,   setHuddleDates]   = useState<Set<string>>(new Set());
  const [qubitDates,    setQubitDates]     = useState<Set<string>>(new Set());
  const [dsrDates,      setDsrDates]       = useState<Set<string>>(new Set());
  const [overrides,     setOverrides]      = useState<Override[]>([]);
  const [loading,       setLoading]        = useState(true);
  const [saving,        setSaving]         = useState<string | null>(null); // "day-task" key

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/huddle?njId=${njId}`).then(r => r.json()),
      fetch(`/api/qubits?njId=${njId}`).then(r => r.json()),
      fetch(`/api/dsr?njId=${njId}`).then(r => r.json()),
      fetch(`/api/stp-task-override?njId=${njId}`).then(r => r.json()),
    ]).then(([huddles, qubits, dsrs, ovrs]) => {
      setHuddleDates(new Set(
        Array.isArray(huddles) ? huddles.filter((h: { completed: boolean }) => h.completed).map((h: { date: string }) => h.date) : []
      ));
      setQubitDates(new Set(
        Array.isArray(qubits) ? qubits.map((q: { date: string }) => q.date) : []
      ));
      setDsrDates(new Set(
        Array.isArray(dsrs) ? dsrs.map((d: { date: string }) => d.date) : []
      ));
      setOverrides(Array.isArray(ovrs) ? ovrs : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [njId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = localISO(new Date());
  const wds   = workingDaysSince(joinDate);

  // Build override lookup: "date-task" → done bool
  const overrideMap = new Map(overrides.map(o => [`${o.date}-${o.task}`, o.done]));

  const resolveStatus = (date: string, task: TaskKey, syncedDone: boolean): TaskStatus => {
    const key = `${date}-${task}`;
    if (overrideMap.has(key)) return overrideMap.get(key) ? "done" : "missed";
    if (syncedDone) return "done";
    if (date > today) return "upcoming";
    const dayNum = rows_dates.indexOf(date) + 1;
    if (dayNum > wds + 1) return "upcoming";
    return "missed";
  };

  // Pre-compute dates for all 14 days
  const rows_dates = Array.from({ length: 14 }, (_, i) => getWorkingDayDate(joinDate, i + 1));

  const rows: DayRow[] = rows_dates.map((date, i) => {
    const day     = i + 1;
    const isPast  = date < today;
    const isToday = date === today;
    return {
      day, date, isPast, isToday,
      huddle: resolveStatus(date, "huddle", huddleDates.has(date)),
      qubits: resolveStatus(date, "qubits", qubitDates.has(date)),
      dsr:    resolveStatus(date, "dsr",    dsrDates.has(date)),
    };
  });

  const handleToggle = async (date: string, task: TaskKey, currentStatus: TaskStatus) => {
    if (!isAdmin || currentStatus === "upcoming") return;
    const newDone = currentStatus !== "done";
    const key = `${date}-${task}`;
    setSaving(key);
    await fetch("/api/stp-task-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ njId, date, task, done: newDone }),
    });
    setSaving(null);
    fetchAll();
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          Day-wise Task Tracker (Days 1–14)
        </p>
        <div className="flex items-center gap-3 text-[9px] font-semibold text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 text-[8px]">✓</span> Done
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-200 flex items-center justify-center text-red-500 text-[8px]">✗</span> Missed
          </span>
          {isAdmin && <span className="text-indigo-400">· Click to override</span>}
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse h-7 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-16">Day</th>
                <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                {(["huddle", "qubits", "dsr"] as TaskKey[]).map(t => (
                  <th key={t} className="text-center px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    {TASK_LABEL[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr
                  key={row.day}
                  className={clsx(
                    "transition-colors",
                    row.isToday && "bg-indigo-50/60",
                    !row.isToday && "hover:bg-gray-50/60"
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx(
                        "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold",
                        row.isToday ? "bg-indigo-600 text-white" :
                        row.isPast  ? "bg-gray-200 text-gray-500" :
                                      "bg-gray-100 text-gray-400"
                      )}>
                        {row.day}
                      </span>
                      {row.isToday && (
                        <span className="text-[9px] font-semibold text-indigo-600">Today</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-gray-400">{fmtDate(row.date)}</td>
                  {(["huddle", "qubits", "dsr"] as TaskKey[]).map(task => {
                    const status = row[task];
                    const canEdit = isAdmin && status !== "upcoming";
                    const savingKey = `${row.date}-${task}`;
                    return (
                      <td key={task} className="px-2 py-2 text-center">
                        <TaskCell
                          status={status}
                          canEdit={canEdit}
                          saving={saving === savingKey}
                          onClick={() => handleToggle(row.date, task, status)}
                        />
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
  );
}
