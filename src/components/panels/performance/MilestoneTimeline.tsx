"use client";

import { clsx } from "clsx";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { fmtTenure } from "@/lib/formatTenure";
import type { PerformanceAlert } from "@/lib/types";

interface Props {
  njId:         number;
  njName:       string;
  joinDate:     string;
  tenureMonths: number;
  alerts:       PerformanceAlert[];
}

const MILESTONES = [
  { month: 1, label: "Orientation", sublabel: "End",      trigger: null    },
  { month: 2, label: "Training",    sublabel: "Complete", trigger: null    },
  { month: 3, label: "PA",          sublabel: "Review",   trigger: "PA"    },
  { month: 4, label: "PIP",         sublabel: "Eligible", trigger: "PIP"   },
  { month: 5, label: "Exit",        sublabel: "Review",   trigger: "EXIT"  },
];

const progressPct = (tenure: number) => Math.min((tenure / 5) * 100, 100);

export function MilestoneTimeline({ njId, njName, joinDate, tenureMonths, alerts }: Props) {
  return (
    <div className="py-3 px-4 bg-gray-50 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{njName}</span>
        <span className="text-[10px] text-gray-400">{fmtTenure(joinDate)} tenure</span>
      </div>

      {/* Timeline track */}
      <div className="relative">
        {/* Background track */}
        <div className="absolute top-4 left-0 right-0 h-1.5 bg-gray-200 rounded-full" />
        {/* Progress fill */}
        <div
          className="absolute top-4 left-0 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progressPct(tenureMonths)}%` }}
        />

        {/* Milestone nodes */}
        <div className="relative flex justify-between">
          {MILESTONES.map(m => {
            const reached   = tenureMonths >= m.month;
            const isCurrent = tenureMonths >= m.month - 1 && tenureMonths < m.month;
            const alert     = m.trigger
              ? alerts.find(a => a.njId === njId && a.alertType === m.trigger)
              : null;
            const isAlert   = alert && !alert.acknowledgedAt;

            return (
              <div key={m.month} className="flex flex-col items-center" style={{ width: "20%" }}>
                <div className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all",
                  isAlert
                    ? "bg-red-100 text-red-600 ring-2 ring-red-300"
                    : reached
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : isCurrent
                    ? "bg-white border-2 border-indigo-400 text-indigo-400"
                    : "bg-white border-2 border-gray-200 text-gray-300"
                )}>
                  {isAlert
                    ? <AlertCircle size={15} />
                    : reached
                    ? <CheckCircle2 size={15} />
                    : <Circle size={15} />
                  }
                </div>
                <div className="mt-1.5 text-center">
                  <p className={clsx(
                    "text-[10px] font-semibold",
                    reached ? "text-indigo-700" : "text-gray-400"
                  )}>
                    {m.label}
                  </p>
                  <p className="text-[9px] text-gray-400">{m.sublabel}</p>
                  {alert && (
                    <p className={clsx(
                      "text-[9px] font-bold mt-0.5",
                      alert.acknowledgedAt ? "text-gray-400" : "text-red-600"
                    )}>
                      {alert.acknowledgedAt ? "✓ Ack'd" : "! Pending"}
                    </p>
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
