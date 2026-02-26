"use client";

import { clsx } from "clsx";

interface DayTaskTrackerProps {
  huddleCompleted?: boolean;
}

export function DayTaskTracker({ huddleCompleted = false }: DayTaskTrackerProps) {
  const tasks = [
    { id: "huddle", label: "Huddle completed",            completed: huddleCompleted, required: true },
    { id: "qubits", label: "Qubits of the day completed", completed: false,           required: true },
    { id: "dsr",    label: "DSR received",                completed: false,           required: true },
  ];

  const completedCount = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const pct = Math.round((completedCount / total) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Today's Tasks</h3>
        <span className="text-xs text-gray-400">{completedCount}/{total}</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={clsx("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-blue-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {tasks.map((task) => (
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
