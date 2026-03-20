"use client";

import { clsx } from "clsx";

export type HuddleStatus = "done" | "missed" | "pending";

interface DayTaskTrackerProps {
  huddleStatus?: HuddleStatus; // undefined = NJ not in 15-working-day window; task hidden
  dsrStatus?: HuddleStatus;    // undefined = not STP WIP; "done" = email received today
}

interface Task {
  id: string;
  label: string;
  status: "done" | "missed" | "pending";
  required: boolean;
}

export function DayTaskTracker({ huddleStatus, dsrStatus }: DayTaskTrackerProps) {
  const tasks: Task[] = [
    ...(huddleStatus !== undefined
      ? [{ id: "huddle", label: "Huddle with HR", status: huddleStatus, required: true }]
      : []),
    { id: "qubits", label: "Qubits of the day completed", status: "pending",          required: true },
    { id: "dsr",    label: "DSR received",                status: dsrStatus ?? "pending", required: true },
  ];

  const doneCount  = tasks.filter((t) => t.status === "done").length;
  const total      = tasks.length;
  const pct        = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Today's Tasks</h3>
        <span className="text-xs text-gray-400">{doneCount}/{total}</span>
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
            {/* Status box: ✓ green, ✗ red, ○ empty */}
            <div
              className={clsx(
                "w-4 h-4 rounded border flex items-center justify-center shrink-0 text-xs font-bold",
                task.status === "done"
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : task.status === "missed"
                    ? "bg-red-400 border-red-400 text-white"
                    : "border-gray-300"
              )}
            >
              {task.status === "done" && "✓"}
              {task.status === "missed" && "✗"}
            </div>

            <span className={clsx(
              "text-xs",
              task.status === "done"   ? "text-gray-400 line-through" :
              task.status === "missed" ? "text-red-500" :
              "text-gray-700"
            )}>
              {task.label}
            </span>

            {task.required && task.status === "pending" && (
              <span className="text-xs text-red-400 ml-auto">Required</span>
            )}
            {task.status === "missed" && (
              <span className="text-xs text-red-400 ml-auto">Missed</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
