"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { clsx } from "clsx";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface HuddleLogProps {
  njId: Id<"newJoiners">;
}

const TODAY = new Date().toISOString().split("T")[0];

export function HuddleLog({ njId }: HuddleLogProps) {
  const logs = useQuery(api.queries.huddleLogs.byNJ, { njId });
  const markComplete = useMutation(api.mutations.huddleLogs.markComplete);

  if (!logs) return <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Huddle Log</h3>
      {logs.length === 0 && (
        <p className="text-xs text-gray-400 py-4 text-center">No huddle sessions recorded</p>
      )}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {logs.map((log: Doc<"huddleLogs">) => {
          const isPast    = log.date < TODAY;
          const isToday   = log.date === TODAY;
          const completed = log.completed;

          return (
            <div
              key={log._id}
              className={clsx(
                "flex items-center justify-between p-2.5 rounded-lg border text-sm",
                completed
                  ? "bg-emerald-50/60 border-emerald-100"
                  : isPast
                    ? "bg-red-50/50 border-red-100"
                    : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center gap-2">
                {/* Status icon */}
                {completed ? (
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                ) : isPast ? (
                  <XCircle size={15} className="text-red-400 shrink-0" />
                ) : (
                  <Clock size={15} className="text-gray-300 shrink-0" />
                )}

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={clsx(
                      "text-xs font-medium px-1.5 py-0.5 rounded-full",
                      completed
                        ? "bg-emerald-100 text-emerald-700"
                        : isPast
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-500"
                    )}>
                      {completed ? "Done" : isPast ? "Missed" : "Pending"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(log.date), "dd MMM")}
                      {isToday && <span className="ml-1 text-indigo-400 font-medium">· Today</span>}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Huddle with HR · By {log.conductedBy}
                  </p>
                </div>
              </div>

              {/* Manual override: only allow marking done for today's pending huddle */}
              {isToday && !completed && (
                <button
                  onClick={() => markComplete({ huddleId: log._id })}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
                >
                  Mark done
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
