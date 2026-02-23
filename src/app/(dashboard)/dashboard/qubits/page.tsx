"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { NJFilter } from "@/components/shared/NJFilter";
import { ExportButton } from "@/components/shared/ExportButton";
import { ScoreTable } from "@/components/panels/qubits/ScoreTable";
import { TrendLineChart } from "@/components/panels/qubits/TrendLineChart";

export default function QubitsPage() {
  const [njId, setNjId] = useState<Id<"newJoiners"> | "all">("all");
  const njs = useQuery(api.queries.newJoiners.list, {});

  const firstNJ = njs?.[0]?._id;
  const activeNJ = njId !== "all" ? njId : firstNJ;

  const scores = useQuery(
    api.queries.qubits.byNJ,
    activeNJ ? { njId: activeNJ } : "skip"
  );
  const trend = useQuery(
    api.queries.qubits.recent7Days,
    activeNJ ? { njId: activeNJ } : "skip"
  );

  const avg =
    scores && scores.length > 0
      ? Math.round(scores.slice(0, 7).reduce((s: number, r: Doc<"qubitScores">) => s + r.score, 0) / Math.min(scores.length, 7))
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Qubit Scores</h1>
          <p className="text-sm text-gray-500 mt-0.5">Call quality scores from RMS</p>
        </div>
        <div className="flex items-center gap-3">
          <NJFilter value={njId} onChange={setNjId} />
          <ExportButton />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">7-Day Avg Score</div>
          <div className={`text-2xl font-bold ${avg !== null ? (avg >= 70 ? "text-emerald-600" : avg >= 50 ? "text-amber-600" : "text-red-600") : "text-gray-300"}`}>
            {avg ?? "—"}
          </div>
          <div className="text-xs text-gray-400">out of 100</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Sessions</div>
          <div className="text-2xl font-bold text-gray-900">{scores?.length ?? "—"}</div>
          <div className="text-xs text-gray-400">last 60 days</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Below Target (&lt;50)</div>
          <div className="text-2xl font-bold text-red-600">
            {scores?.filter((s: Doc<"qubitScores">) => s.score < 50).length ?? "—"}
          </div>
          <div className="text-xs text-gray-400">sessions</div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">7-Day Trend</h2>
        {trend ? (
          <TrendLineChart data={trend} />
        ) : (
          <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />
        )}
      </div>

      {/* Score table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Score History</h2>
        {scores ? (
          <ScoreTable scores={scores} />
        ) : (
          <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />
        )}
      </div>
    </div>
  );
}
