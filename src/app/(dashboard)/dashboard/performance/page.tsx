"use client";

import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import { ExportButton } from "@/components/shared/ExportButton";
import { CategoryTable } from "@/components/panels/performance/CategoryTable";
import { MilestoneTimeline } from "@/components/panels/performance/MilestoneTimeline";
import { AlertCentre } from "@/components/panels/performance/AlertCentre";
import { ShieldAlert, BarChart2 } from "lucide-react";

export default function PerformancePage() {
  const catRows = useQuery(api.queries.performance.categoryTable);
  const njs = useQuery(api.queries.newJoiners.list, {});
  const pendingAlerts = useQuery(api.queries.performance.pendingAlerts);
  const alertCount = pendingAlerts?.length ?? 0;
  const totalNJs = catRows ? catRows.reduce((s: number, r: { count: number }) => s + r.count, 0) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance & Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Category breakdown, milestones, and alert centre</p>
        </div>
        <ExportButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category table */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <BarChart2 size={16} className="text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-800">NJ Categories</h2>
            <span className="ml-auto text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{totalNJs} total</span>
          </div>
          {catRows ? (
            <CategoryTable rows={catRows} total={totalNJs} />
          ) : (
            <div className="shimmer h-48 rounded-xl" />
          )}
        </div>

        {/* Alert Centre */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-slide-up" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <ShieldAlert size={16} className="text-red-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-800">Alert Centre</h2>
            {alertCount > 0 && (
              <span className="ml-auto text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full pulse-dot">
                {alertCount} pending
              </span>
            )}
          </div>
          <AlertCentre />
        </div>
      </div>

      {/* Milestone Timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-slide-up" style={{ animationDelay: "120ms" }}>
        <h2 className="text-sm font-semibold text-gray-800 mb-6">Milestone Timelines</h2>
        {njs && pendingAlerts ? (
          <div className="space-y-8 stagger">
            {njs
              .filter((n: Doc<"newJoiners">) => n.isActive)
              .map((nj: Doc<"newJoiners">) => (
                <MilestoneTimeline key={nj._id} nj={nj} alerts={pendingAlerts} />
              ))}
          </div>
        ) : (
          <div className="shimmer h-48 rounded-xl" />
        )}
      </div>
    </div>
  );
}
