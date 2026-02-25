"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { NJFilter } from "@/components/shared/NJFilter";
import { ExportButton } from "@/components/shared/ExportButton";
import { CorpClaimsTable } from "@/components/panels/rcb/CorpClaimsTable";
function formatINR(v:number){ const sign = v < 0 ? "-" : ""; return `${sign}${Math.abs(v).toLocaleString("en-IN")}`; }
export default function RCBPage() {
  const [njId, setNjId] = useState<Id<"newJoiners"> | "all">("all");
  const njs = useQuery(api.queries.newJoiners.list, {});
  const firstNJ = njs?.[0]?._id;
  const activeNJ = njId !== "all" ? njId : firstNJ;
  const claims = useQuery(api.queries.rcb.byNJ, activeNJ ? { njId: activeNJ } : "skip");
  const summary = useQuery(api.queries.rcb.claimSummary, activeNJ ? { njId: activeNJ } : "skip");
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-gray-900">RCB Claims</h1><p className="text-sm text-gray-500 mt-0.5">Recruited Corporate Business claims</p></div>
        <div className="flex items-center gap-3"><NJFilter value={njId} onChange={setNjId} /><ExportButton /></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          {label:"Total Claims",value:summary?.total},
          {label:"Approved",value:summary?.byStatus?.["Approved"]??0,green:true},
          {label:"Pending",value:summary?.byStatus?.["Pending"]??0,amber:true},
          {label:"Approved Revenue",value:summary?.totalApprovedRevenue!=null?formatINR(summary.totalApprovedRevenue):undefined},
        ].map(c=>(
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className={`text-2xl font-bold ${c.green?"text-emerald-600":c.amber?"text-amber-600":"text-gray-900"}`}>{c.value??<span className="text-gray-300">—</span>}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Claims History</h2>
        {claims ? <CorpClaimsTable claims={claims} /> : <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />}
      </div>
    </div>
  );
}
