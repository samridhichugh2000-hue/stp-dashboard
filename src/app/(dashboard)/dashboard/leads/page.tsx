"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { NJFilter } from "@/components/shared/NJFilter";
import { ExportButton } from "@/components/shared/ExportButton";
import { LeadTable } from "@/components/panels/leads/LeadTable";
import { PipelineFunnel } from "@/components/panels/leads/PipelineFunnel";
export default function LeadsPage() {
  const [njId, setNjId] = useState<Id<"newJoiners"> | "all">("all");
  const njs = useQuery(api.queries.newJoiners.list, {});
  const firstNJ = njs?.[0]?._id;
  const activeNJ = njId !== "all" ? njId : firstNJ;
  const leads = useQuery(api.queries.leads.byNJ, activeNJ ? { njId: activeNJ } : "skip");
  const summary = useQuery(api.queries.leads.summary, activeNJ ? { njId: activeNJ } : "skip");
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-gray-900">Leads / TAT</h1><p className="text-sm text-gray-500 mt-0.5">Lead pipeline and turnaround time tracking</p></div>
        <div className="flex items-center gap-3"><NJFilter value={njId} onChange={setNjId} /><ExportButton /></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[{label:"Total Leads",value:summary?.total},{label:"TAT Breached",value:summary?.tatBreached,red:true},{label:"Self-Generated",value:summary?.selfGenerated},{label:"Avg TAT",value:summary?.avgTatHours!=null?`${summary.avgTatHours}h`:undefined}].map(c=>(
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className={`text-2xl font-bold ${c.red&&(summary?.tatBreached??0)>0?"text-red-600":"text-gray-900"}`}>{c.value??<span className="text-gray-300">—</span>}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Pipeline</h2>
          {summary ? <PipelineFunnel byStatus={summary.byStatus} /> : <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">All Leads</h2>
          {leads ? <LeadTable leads={leads} /> : <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />}
        </div>
      </div>
    </div>
  );
}
