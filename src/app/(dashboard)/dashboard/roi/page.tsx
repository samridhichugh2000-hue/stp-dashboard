"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { NJFilter } from "@/components/shared/NJFilter";
import { ExportButton } from "@/components/shared/ExportButton";
import { ROIHeatmap } from "@/components/panels/roi/ROIHeatmap";
export default function ROIPage() {
  const [njId, setNjId] = useState<Id<"newJoiners"> | "all">("all");
  const njs = useQuery(api.queries.newJoiners.list, {});
  const heatmap = useQuery(api.queries.roi.weeklyHeatmap);
  const firstNJ = njs?.[0]?._id;
  const activeNJ = njId !== "all" ? njId : firstNJ;
  const consRed = useQuery(api.queries.roi.consecutiveRedCount, activeNJ ? { njId: activeNJ } : "skip");
  const njNames = Object.fromEntries(njs?.map((n: Doc<"newJoiners">) => [n._id, n.name]) ?? []);
  const njIds = njs?.map((n: Doc<"newJoiners">) => n._id) ?? [];
  const allRecords = heatmap?.records ?? [];
  const greenCount = allRecords.filter((r: Doc<"roiRecords">) => r.colorCode === "Green").length;
  const redCount = allRecords.filter((r: Doc<"roiRecords">) => r.colorCode === "Red").length;
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-gray-900">ROI Heatmap</h1><p className="text-sm text-gray-500 mt-0.5">Weekly ROI colour coding across NJs</p></div>
        <div className="flex items-center gap-3"><NJFilter value={njId} onChange={setNjId} /><ExportButton /></div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-1">Green Weeks (All NJs)</div><div className="text-2xl font-bold text-emerald-600">{heatmap?greenCount:<span className="text-gray-300">—</span>}</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-1">Red Weeks (All NJs)</div><div className="text-2xl font-bold text-red-600">{heatmap?redCount:<span className="text-gray-300">—</span>}</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 mb-1">Consec. Red (Selected NJ)</div><div className={`text-2xl font-bold ${(consRed??0)>=2?"text-red-600":"text-gray-900"}`}>{consRed??<span className="text-gray-300">—</span>}</div></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">8-Week ROI Heatmap</h2>
        {heatmap ? <ROIHeatmap records={heatmap.records} weekStarts={heatmap.weekStarts} njIds={njIds} njNames={njNames} /> : <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />}
      </div>
    </div>
  );
}
