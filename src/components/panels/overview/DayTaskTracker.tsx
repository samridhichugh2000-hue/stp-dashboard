"use client";

import { clsx } from "clsx";

interface Task {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
}

const DAILY_TASKS: Task[] = [
  { id: "huddle",      label: "Huddle completed",          completed: false, required: true },
  { id: "qubits",     label: "Qubits of the day completed", completed: false, required: true },
  { id: "dsr",        label: "DSR received",               completed: false, required: true },
  { id: "nr_numbers", label: "Current NR numbers",         completed: false, required: true },
  { id: "roi_numbers",label: "Current ROI numbers",        completed: false, required: true },
];

export function DayTaskTracker() {
  const completed = DAILY_TASKS.filter((t) => t.completed).length;
  const total = DAILY_TASKS.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Today's Tasks</h3>
        <span className="text-xs text-gray-400">{completed}/{total}</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={clsx("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-blue-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {DAILY_TASKS.map((task) => (
          <div key={task.id} className="flex items-center gap-2 text-sm">
            <div
              className={clsx(
                "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                task.completed ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
              )}
              aria-hidden="true"
            >
              {task.completed && <span className="text-white text-xs">✓</span>}
            </div>
            <span className={clsx("text-xs", task.completed ? "text-gray-400 line-through" : "text-gray-700")}>
              {task.label}
            </span>
            {task.required && !task.completed && (
              <span className="text-xs text-red-400 ml-auto">Required</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
