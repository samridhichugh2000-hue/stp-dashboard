"use client";

import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import { X, Hash, UserCircle2, MapPin, CalendarDays, Mail } from "lucide-react";
import { clsx } from "clsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function fmtDOJ(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTenure(m: number) {
  if (m < 1) return "< 1 mo";
  if (m < 12) return `${m} mo`;
  const yr = Math.floor(m / 12), mo = m % 12;
  return mo > 0 ? `${yr}y ${mo}mo` : `${yr}y`;
}
function fmtINR(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000)      return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

// ── Category ──────────────────────────────────────────────────────────────────

type DisplayCategory = "Developed" | "Not Developed" | "New Joiner" | "Inactive";

function getDisplayCategory(nj: Doc<"newJoiners">): DisplayCategory {
  if (!nj.isActive) return "Inactive";
  const daysSince = (Date.now() - new Date(nj.joinDate).getTime()) / 86_400_000;
  if (daysSince < 30) return "New Joiner";
  if (nj.category === "Developed") return "Developed";
  return "Not Developed";
}

function StatusPill({ cat }: { cat: DisplayCategory }) {
  const cls: Record<DisplayCategory, string> = {
    "Developed":     "bg-emerald-100 text-emerald-700",
    "Not Developed": "bg-red-100 text-red-600",
    "New Joiner":    "bg-violet-100 text-violet-700",
    "Inactive":      "bg-gray-100 text-gray-500",
  };
  return (
    <span className={clsx("inline-block text-xs font-semibold px-3 py-1 rounded-full", cls[cat])}>
      {cat}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MetricSkeleton() {
  return <div className="animate-pulse h-6 bg-gray-200 rounded w-16 mx-auto" />;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  nj: Doc<"newJoiners">;
  onClose: () => void;
}

export function NJDetailModal({ nj, onClose }: Props) {
  const njId     = nj._id;
  const today    = new Date();
  const curMonth = today.getMonth() + 1;
  const curYear  = today.getFullYear();

  // All NR records for this NJ — same DB source as ROI & Leads page
  const nrRecords = useQuery(api.queries.nr.byNJ, { njId });
  const currentNR = nrRecords?.find(r => r.month === curMonth && r.year === curYear) ?? null;

  // Total ROI = sum of all monthly NR values (same as ROI & Leads page table)
  const totalROI = nrRecords !== undefined
    ? nrRecords.reduce((sum, r) => sum + r.nrValue, 0)
    : null;

  const displayCat = getDisplayCategory(nj);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl z-10 overflow-hidden">

        {/* ── Profile Header ───────────────────────────────────────── */}
        <div className={`px-6 pt-6 pb-5 text-white ${nj.isActive
          ? "bg-gradient-to-br from-indigo-600 to-violet-700"
          : "bg-gradient-to-br from-gray-500 to-gray-600"}`}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-bold flex-shrink-0">
              {initials(nj.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold">{nj.name}</h2>
              {nj.designation && <p className="text-white/70 text-xs mt-0.5">{nj.designation}</p>}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-white/60">
                {nj.empId && <span className="flex items-center gap-1"><Hash size={10} />{nj.empId}</span>}
                <span className="flex items-center gap-1"><CalendarDays size={10} />Joined {fmtDOJ(nj.joinDate)}</span>
                <span>{fmtTenure(nj.tenureMonths)}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/70 hover:text-white flex-shrink-0">
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-white/65">
            {nj.managerId && <span className="flex items-center gap-1.5"><UserCircle2 size={10} />{nj.managerId}</span>}
            {nj.location  && <span className="flex items-center gap-1.5"><MapPin size={10} />{nj.location}</span>}
            {nj.email     && <span className="flex items-center gap-1.5"><Mail size={10} />{nj.email}</span>}
            <span className="px-2 py-0.5 rounded-full bg-white/15 font-semibold">{nj.currentPhase}</span>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5">

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Status:</span>
            <StatusPill cat={displayCat} />
          </div>

          {/* 2 metric cards */}
          <div className="grid grid-cols-2 gap-4">

            {/* ROI — total NR from DB (same as ROI & Leads page) */}
            <div className={clsx(
              "rounded-xl p-5 text-center",
              totalROI !== null && totalROI > 0 ? "bg-emerald-50" :
              totalROI !== null && totalROI < 0 ? "bg-red-50"     : "bg-gray-50"
            )}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">ROI</p>
              {nrRecords === undefined ? <MetricSkeleton /> : totalROI !== null ? (
                <p className={clsx("text-2xl font-black leading-none",
                  totalROI > 0 ? "text-emerald-700" :
                  totalROI < 0 ? "text-red-600"     : "text-gray-700"
                )}>
                  {fmtINR(totalROI)}
                </p>
              ) : <p className="text-gray-300 text-2xl font-black">—</p>}
            </div>

            {/* Current month NR — from Convex (CCE NR API sync) */}
            <div className="bg-gray-50 rounded-xl p-5 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                {today.toLocaleDateString("en-IN", { month: "short" })} NR
              </p>
              {nrRecords === undefined ? <MetricSkeleton /> : currentNR ? (
                <>
                  <p className="text-2xl font-black text-gray-900 leading-none">{fmtINR(currentNR.nrValue)}</p>
                  <p className={clsx("text-[11px] font-semibold mt-2", currentNR.isPositive ? "text-green-600" : "text-red-500")}>
                    {currentNR.isPositive ? "Positive" : "Negative"}
                  </p>
                </>
              ) : <p className="text-gray-300 text-2xl font-black">—</p>}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
