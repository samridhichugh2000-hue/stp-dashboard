"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { clsx } from "clsx";
import { CheckCircle, Circle } from "lucide-react";
import { format } from "date-fns";

interface HuddleLogProps {
  njId: Id<"newJoiners">;
}

const TYPE_COLORS: Record<string, string> = {
  Daily: "bg-blue-100 text-blue-700",
  Weekly: "bg-purple-100 text-purple-700",
  Monthly: "bg-emerald-100 text-emerald-700",
  "Ad-hoc": "bg-gray-100 text-gray-600",
};

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
        {logs.map((log: Doc<"huddleLogs">) => (
          <div
            key={log._id}
            className={clsx(
              "flex items-center justify-between p-2.5 rounded-lg border text-sm",
              log.completed ? "bg-gray-50 border-gray-100" : "bg-white border-gray-200"
            )}
          >
            <div className="flex items-center gap-2">
              {log.completed ? (
                <CheckCircle size={15} className="text-emerald-500 shrink-0" />
              ) : (
                <Circle size={15} className="text-gray-300 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={clsx("text-xs font-medium px-1.5 py-0.5 rounded-full", TYPE_COLORS[log.type] ?? "bg-gray-100 text-gray-600")}>
                    {log.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(log.date), "dd MMM")}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">By {log.conductedBy}</p>
              </div>
            </div>
            {!log.completed && (
              <button
                onClick={() => markComplete({ huddleId: log._id })}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark done
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
