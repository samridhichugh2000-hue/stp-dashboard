"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { NJFilter } from "@/components/shared/NJFilter";
import { ExportButton } from "@/components/shared/ExportButton";
import { CorpClaimsTable } from "@/components/panels/rcb/CorpClaimsTable";

function formatINR(v: number) {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

export default function RCBPage() {
  const [njId, setNjId] = useState<Id<"newJoiners"> | "all">("all");
  const njs = useQuery(api.queries.newJoiners.list, {});
  const firstNJ = njs?.[0]?._id;
  const activeNJ = njId !== "all" ? njId : firstNJ;
  const claims = useQuery(api.queries.rcb.byNJ, activeNJ ? { njId: activeNJ } : "skip");
  const summary = useQuery(api.queries.rcb.claimSummary, activeNJ ? { njId: activeNJ } : "skip");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RCB Claims</h1>
          <p className="text-sm text-gray-500 mt-0.5">Recruited Corporate Business claims</p>
        </div>
        <div className="flex items-center gap-3">
          <NJFilter value={njId} onChange={setNjId} />
          <ExportButton />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Total Claims</div>
          <div className="text-4xl font-black">{summary?.total ?? <span className="text-white/40">—</span>}</div>
          <div className="text-xs text-white/60 mt-1">All submitted</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Approved</div>
          <div className="text-4xl font-black">{summary?.byStatus?.["Approved"] ?? 0}</div>
          <div className="text-xs text-white/60 mt-1">Claims approved</div>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Pending</div>
          <div className="text-4xl font-black">{summary?.byStatus?.["Pending"] ?? 0}</div>
          <div className="text-xs text-white/60 mt-1">Awaiting review</div>
        </div>
        <div className="bg-gradient-to-br from-slate-600 to-gray-800 rounded-2xl p-5 text-white shadow-lg card-hover">
          <div className="text-xs font-medium text-white/70 mb-2">Approved Revenue</div>
          <div className="text-xl font-black tabular-nums">
            {summary?.totalApprovedRevenue != null ? formatINR(summary.totalApprovedRevenue) : <span className="text-white/40">—</span>}
          </div>
          <div className="text-xs text-white/60 mt-1">Total value</div>
        </div>
      </div>

      {/* Claims table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Claims History</h2>
        {claims
          ? <CorpClaimsTable claims={claims} />
          : <div className="animate-pulse h-48 bg-gray-50 rounded-xl" />}
      </div>
    </div>
  );
}
