"use client";

import { clsx } from "clsx";
import { AlertBadge } from "@/components/shared/AlertBadge";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";

interface NJCardProps {
  nj: {
    _id: string;
    name: string;
    joinDate: string;
    currentPhase: string;
    category: string;
    tenureMonths: number;
    isActive: boolean;
  };
  alerts?: Array<{ alertType: string; acknowledgedAt?: string }>;
  onClick?: () => void;
  selected?: boolean;
}

const CATEGORY_META: Record<string, { bg: string; text: string; strip: string }> = {
  Developed:            { bg: "bg-emerald-50", text: "text-emerald-700", strip: "bg-emerald-500" },
  Performer:            { bg: "bg-blue-50",    text: "text-blue-700",    strip: "bg-blue-500" },
  "Performance Falling":{ bg: "bg-amber-50",   text: "text-amber-700",   strip: "bg-amber-500" },
  "Non-Performer":      { bg: "bg-red-50",     text: "text-red-700",     strip: "bg-red-500" },
  Uncategorised:        { bg: "bg-gray-50",    text: "text-gray-600",    strip: "bg-gray-400" },
};

const PHASE_META: Record<string, { bg: string; text: string }> = {
  Orientation: { bg: "bg-purple-100", text: "text-purple-700" },
  Training:    { bg: "bg-sky-100",    text: "text-sky-700" },
  Field:       { bg: "bg-emerald-100",text: "text-emerald-700" },
  Graduated:   { bg: "bg-gray-100",   text: "text-gray-600" },
};

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
  const idx = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

export function NJCard({ nj, alerts = [], onClick, selected }: NJCardProps) {
  const unackAlerts = alerts.filter((a) => !a.acknowledgedAt);
  const catMeta = CATEGORY_META[nj.category] ?? CATEGORY_META.Uncategorised;
  const phaseMeta = PHASE_META[nj.currentPhase] ?? PHASE_META.Orientation;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "animate-slide-left w-full text-left rounded-xl border transition-all duration-200 overflow-hidden card-hover group",
        selected
          ? "border-indigo-400 shadow-md bg-indigo-50"
          : "border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm"
      )}
      aria-pressed={selected}
    >
      {/* Category color strip */}
      <div className={`h-1 w-full ${catMeta.strip} transition-all duration-200`} />

      <div className="p-3.5 flex items-center gap-3">
        {/* Avatar */}
        <div
          className={clsx(
            "flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold shadow-sm",
            getGradient(nj.name)
          )}
        >
          {getInitials(nj.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-900 text-sm truncate">{nj.name}</span>
            {unackAlerts.length > 0 && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 pulse-dot" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span
              className={clsx(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                phaseMeta.bg, phaseMeta.text
              )}
            >
              {nj.currentPhase}
            </span>
            <span
              className={clsx(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                catMeta.bg, catMeta.text
              )}
            >
              {nj.category}
            </span>
            <span className="text-[10px] text-gray-400">{nj.tenureMonths}mo</span>
          </div>
        </div>

        {/* Alert badges or chevron */}
        <div className="flex-shrink-0">
          {unackAlerts.length > 0 ? (
            <div className="flex flex-col gap-1">
              {unackAlerts.slice(0, 2).map((a, i) => (
                <AlertBadge key={i} type={a.alertType} size="sm" />
              ))}
            </div>
          ) : (
            <ChevronRight
              size={15}
              className={clsx(
                "transition-all duration-200",
                selected ? "text-indigo-500 translate-x-0.5" : "text-gray-300 group-hover:text-indigo-400"
              )}
            />
          )}
        </div>
      </div>
    </button>
  );
}
