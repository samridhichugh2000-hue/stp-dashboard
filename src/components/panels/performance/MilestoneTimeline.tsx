"use client";

import { clsx } from "clsx";
import { Doc } from "@/../convex/_generated/dataModel";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface NJ {
  _id: string;
  name: string;
  joinDate: string;
  tenureMonths: number;
  currentPhase: string;
}

const MILESTONES = [
  { month: 1, label: "Orientation", sublabel: "End" },
  { month: 2, label: "Training", sublabel: "Complete" },
  { month: 3, label: "PA", sublabel: "Review" },
  { month: 4, label: "PIP", sublabel: "Eligible" },
  { month: 5, label: "Exit", sublabel: "Review" },
];

export function MilestoneTimeline({
  nj,
  alerts,
}: {
  nj: NJ;
  alerts: Doc<"performanceAlerts">[];
}) {
  const progressPct = Math.min((nj.tenureMonths / 5) * 100, 100);

  return (
    <div className="animate-slide-up">
      {/* NJ name + tenure */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-sm font-semibold text-gray-800">{nj.name}</span>
          <span className="text-xs text-gray-400 ml-2">{nj.tenureMonths} months tenure</span>
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
          {nj.currentPhase}
        </span>
      </div>

      {/* Timeline track */}
      <div className="relative">
        {/* Background track */}
        <div className="absolute top-4 left-0 right-0 h-1.5 bg-gray-100 rounded-full" />
        {/* Progress fill */}
        <div
          className="absolute top-4 left-0 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 bar-fill"
          style={{ "--bar-width": `${progressPct}%` } as React.CSSProperties}
        />

        {/* Milestones */}
        <div className="relative flex justify-between">
          {MILESTONES.map((m) => {
            const reached = nj.tenureMonths >= m.month;
            const isCurrent = nj.tenureMonths === m.month - 1;
            const alert = alerts.find(
              (a) =>
                a.njId === nj._id &&
                ((m.month === 3 && a.alertType === "PA") ||
                  (m.month === 4 && a.alertType === "PIP") ||
                  (m.month === 5 && a.alertType === "EXIT"))
            );

            return (
              <div key={m.month} className="flex flex-col items-center" style={{ width: "20%" }}>
                {/* Node */}
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-300",
                    alert && !alert.acknowledgedAt
                      ? "bg-red-100 text-red-600"
                      : reached
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : isCurrent
                      ? "bg-white border-2 border-indigo-400 text-indigo-400"
                      : "bg-white border-2 border-gray-200 text-gray-300"
                  )}
                >
                  {alert && !alert.acknowledgedAt ? (
                    <AlertCircle size={15} />
                  ) : reached ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Circle size={15} />
                  )}
                </div>

                {/* Label */}
                <div className="mt-2 text-center">
                  <div
                    className={clsx(
                      "text-[10px] font-semibold leading-tight",
                      reached ? "text-indigo-700" : "text-gray-400"
                    )}
                  >
                    {m.label}
                  </div>
                  <div className="text-[10px] text-gray-400">{m.sublabel}</div>
                  {alert && (
                    <div
                      className={clsx(
                        "text-[10px] font-bold mt-0.5 px-1 rounded",
                        alert.acknowledgedAt
                          ? "text-gray-400 bg-gray-50"
                          : "text-red-600 bg-red-50"
                      )}
                    >
                      {alert.alertType}
                      {alert.acknowledgedAt ? " ✓" : " !"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
