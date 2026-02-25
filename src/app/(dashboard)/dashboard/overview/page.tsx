"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc, Id } from "@/../convex/_generated/dataModel";
import { HuddleLog } from "@/components/panels/overview/HuddleLog";
import { Users, UserCheck, UserX } from "lucide-react";
import { clsx } from "clsx";

const MONTHS_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDOJ(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-indigo-400 to-violet-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-rose-500",
];

function getGradient(name: string) {
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
      {value != null && value !== "" ? (
        <span className="text-sm text-gray-800 font-medium">{value}</span>
      ) : (
        <span className="text-sm text-gray-300">—</span>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const [selectedId, setSelectedId] = useState<Id<"newJoiners"> | null>(null);

  const allNjs   = useQuery(api.queries.newJoiners.list, { includeInactive: true });
  const activeNjs = useQuery(api.queries.newJoiners.list, {});

  if (!allNjs || !activeNjs) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="shimmer h-11 rounded-xl" />)}
          </div>
          <div className="lg:col-span-2 shimmer h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const totalNJs  = allNjs.length;
  const stpActive = allNjs.filter((n: Doc<"newJoiners">) => n.isActive).length;
  const stpClosed = allNjs.filter((n: Doc<"newJoiners">) => !n.isActive).length;

  const selected = selectedId
    ? allNjs.find((n: Doc<"newJoiners">) => n._id === selectedId) ?? null
    : null;

  const statCards = [
    { label: "Total NJs",   value: totalNJs,  icon: <Users size={20} />,      gradient: "from-indigo-500 to-violet-600" },
    { label: "STP Active",  value: stpActive, icon: <UserCheck size={20} />,  gradient: "from-emerald-500 to-teal-600" },
    { label: "STP Closed",  value: stpClosed, icon: <UserX size={20} />,      gradient: "from-rose-500 to-red-600" },
  ];

  const sortedActive = [...activeNjs].sort((a: Doc<"newJoiners">, b: Doc<"newJoiners">) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">New Joiner programme at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((c) => (
          <div key={c.label} className={`bg-gradient-to-br ${c.gradient} rounded-2xl p-5 text-white shadow-lg card-hover`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">{c.label}</span>
              <span className="opacity-50">{c.icon}</span>
            </div>
            <div className="text-5xl font-black">{c.value}</div>
          </div>
        ))}
      </div>

      {/* NJ list + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: name list */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">New Joiners</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{activeNjs.length}</span>
          </div>
          <div className="space-y-1.5">
            {sortedActive.map((nj: Doc<"newJoiners">) => (
              <button
                key={nj._id}
                onClick={() => setSelectedId(selectedId === nj._id ? null : nj._id)}
                className={clsx(
                  "w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150",
                  selectedId === nj._id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                    : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                )}
              >
                {nj.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="space-y-4 animate-scale-in">

              {/* Profile card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                {/* Avatar + bold name */}
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
                  <div className={clsx(
                    "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-lg font-bold shadow-sm flex-shrink-0",
                    getGradient(selected.name)
                  )}>
                    {getInitials(selected.name)}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">{selected.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Joined {fmtDOJ(selected.joinDate)} · {selected.tenureMonths} month{selected.tenureMonths !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Detail fields grid — order: Department, Designation, Manager, Email ID, Emp ID, Location */}
                <div className="grid grid-cols-2 gap-x-10 gap-y-5">
                  <DetailField label="Department"  value={selected.department} />
                  <DetailField label="Designation" value={(selected as Record<string, unknown>).designation as string | undefined} />
                  <DetailField label="Manager"     value={selected.managerId} />
                  <DetailField label="Email ID"    value={selected.email} />
                  <DetailField label="Emp ID"      value={selected.empId} />
                  <DetailField label="Location"    value={selected.location} />
                </div>
              </div>

              {/* Huddle log */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <HuddleLog njId={selectedId!} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-gray-200 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Users size={26} className="text-indigo-400" />
              </div>
              <p className="text-gray-700 font-semibold">Select a New Joiner</p>
              <p className="text-sm text-gray-400 mt-1">Click a name on the left to view their details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
