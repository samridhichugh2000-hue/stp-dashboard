"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { NJCard } from "@/components/panels/overview/NJCard";
import { HuddleLog } from "@/components/panels/overview/HuddleLog";
import { DayTaskTracker } from "@/components/panels/overview/DayTaskTracker";
import { ExportButton } from "@/components/shared/ExportButton";
import { StatCard } from "@/components/shared/StatCard";
import { Users, AlertTriangle, BarChart2, Clock } from "lucide-react";

export default function OverviewPage() {
  const [selectedNJ, setSelectedNJ] = useState<Id<"newJoiners"> | null>(null);
  const njs = useQuery(api.queries.newJoiners.list, {});
  const alerts = useQuery(api.queries.performance.pendingAlerts);
  const summary = useQuery(api.queries.performance.dashboardSummary);

  // Loading skeleton
  if (!njs || !summary) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Stat card skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="shimmer h-32 rounded-2xl" />
          ))}
        </div>
        {/* List skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="shimmer h-24 rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-2 shimmer h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const activeNJ = njs.filter((n: Doc<"newJoiners">) => n.isActive);
  const displayNJ = selectedNJ ? njs.find((n: Doc<"newJoiners">) => n._id === selectedNJ) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NJ Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitor your new joiner pipeline in real time
          </p>
        </div>
        <ExportButton />
      </div>

      {/* ── KPI Stat Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard
          label="Active NJs"
          value={summary.activeNJs}
          subtitle="Currently enrolled"
          icon={<Users size={20} />}
          gradient="from-indigo-500 to-violet-600"
          trend={{ value: 12, label: "vs last month" }}
          animationDelay={0}
        />
        <StatCard
          label="Pending Alerts"
          value={summary.pendingAlerts}
          subtitle="Need acknowledgement"
          icon={<AlertTriangle size={20} />}
          gradient="from-rose-500 to-red-600"
          trend={{ value: -5, label: "vs last week" }}
          animationDelay={60}
        />
        <StatCard
          label="Avg Qubit Score"
          value={summary.avgQubitScore}
          suffix="/100"
          subtitle="Call quality average"
          icon={<BarChart2 size={20} />}
          gradient="from-emerald-500 to-teal-600"
          trend={{ value: 8, label: "vs last week" }}
          animationDelay={120}
        />
        <StatCard
          label="Total Leads"
          value={summary.totalLeads}
          subtitle={`${summary.tatBreached} TAT breached`}
          icon={<Clock size={20} />}
          gradient="from-amber-500 to-orange-600"
          trend={{ value: 3, label: "vs yesterday" }}
          animationDelay={180}
        />
      </div>

      {/* ── Phase distribution bar ──────────────────────────────────────── */}
      <div className="animate-slide-up bg-white rounded-2xl border border-gray-100 p-5 shadow-sm" style={{ animationDelay: "240ms" }}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Phase Distribution</p>
        <div className="flex items-center gap-3">
          {(["Orientation", "Training", "Field", "Graduated"] as const).map((phase, idx) => {
            const count = summary.byPhase[phase] ?? 0;
            const pct = summary.activeNJs > 0 ? Math.round((count / summary.activeNJs) * 100) : 0;
            const colors = [
              "from-purple-400 to-purple-500",
              "from-sky-400 to-sky-500",
              "from-emerald-400 to-emerald-500",
              "from-gray-300 to-gray-400",
            ];
            const textColors = ["text-purple-700", "text-sky-700", "text-emerald-700", "text-gray-600"];
            const bgColors = ["bg-purple-50", "bg-sky-50", "bg-emerald-50", "bg-gray-50"];
            return (
              <div key={phase} className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${textColors[idx]}`}>{phase}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${bgColors[idx]} ${textColors[idx]}`}>{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${colors[idx]} bar-fill`}
                    style={{ "--bar-width": `${pct}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── NJ List + Detail panel ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* NJ cards list */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">New Joiners</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{activeNJ.length}</span>
          </div>
          <div className="space-y-2 stagger">
            {activeNJ.map((nj: Doc<"newJoiners">) => {
              const njAlerts = alerts?.filter((a: Doc<"performanceAlerts">) => a.njId === nj._id) ?? [];
              return (
                <NJCard
                  key={nj._id}
                  nj={nj}
                  alerts={njAlerts}
                  selected={selectedNJ === nj._id}
                  onClick={() => setSelectedNJ(selectedNJ === nj._id ? null : nj._id)}
                />
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {selectedNJ && displayNJ ? (
            <div className="space-y-4 animate-scale-in">
              {/* NJ header card */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-lg font-bold">
                    {displayNJ.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{displayNJ.name}</h3>
                    {displayNJ.designation && (
                      <p className="text-indigo-100 text-xs font-medium mt-0.5">{displayNJ.designation}</p>
                    )}
                    <p className="text-indigo-200 text-sm mt-0.5">
                      Joined {new Date(displayNJ.joinDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      · {displayNJ.tenureMonths} months tenure
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">{displayNJ.currentPhase}</span>
                    <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">{displayNJ.category}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <DayTaskTracker />
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <HuddleLog njId={selectedNJ} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 bg-white rounded-2xl border border-dashed border-gray-200 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Users size={28} className="text-indigo-400" />
              </div>
              <p className="text-gray-700 font-semibold">Select a New Joiner</p>
              <p className="text-sm text-gray-400 mt-1">Click any card on the left to view their details, tasks and huddle logs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
