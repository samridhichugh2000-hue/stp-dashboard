"use client";

import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import { clsx } from "clsx";

const MODULE_LABELS: Record<string, string> = {
  Qubits: "Qubits",
  Leads: "Leads",
  NRD: "NRD",
  ROI: "ROI",
  RCB: "RCB",
};

function formatRelative(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  } catch {
    return "—";
  }
}

export function SyncStatusBar() {
  const logs = useQuery(api.queries.syncLogs.latestByModule);

  if (!logs) return null;

  return (
    <footer className="flex items-center gap-5 px-6 py-2.5 bg-white border-t border-gray-100 text-xs no-print overflow-x-auto">
      <span className="font-semibold text-gray-400 shrink-0 uppercase tracking-wider text-[10px]">
        RMS Sync
      </span>
      {Object.entries(MODULE_LABELS).map(([mod, label]) => {
        const log = logs.find((l: Doc<"syncLogs">) => l.module === mod);
        const status = log?.status ?? "unknown";
        return (
          <div key={mod} className="flex items-center gap-1.5 shrink-0">
            <span
              className={clsx("w-2 h-2 rounded-full", {
                "bg-emerald-500": status === "success",
                "bg-red-500": status === "error",
                "bg-amber-400 animate-pulse": status === "running",
                "bg-gray-300": status === "unknown",
              })}
              aria-label={`${label}: ${status}`}
            />
            <span
              className={clsx("font-medium", {
                "text-gray-600": status === "success" || status === "unknown",
                "text-red-600": status === "error",
                "text-amber-600": status === "running",
              })}
            >
              {label}
            </span>
            {log && (
              <span className="text-gray-400">{formatRelative(log.lastSyncAt)}</span>
            )}
          </div>
        );
      })}
    </footer>
  );
}
