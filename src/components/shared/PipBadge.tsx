"use client";

interface PipBadgeProps {
  pipStatus: string | null | undefined;
  pipFirstSeenAt?: string | null;
  pipFromDate?: string | null;
  pipToDate?: string | null;
  className?: string;
}

export function PipBadge({ pipStatus, pipFromDate, pipToDate, className = "" }: PipBadgeProps) {
  if (!pipStatus || (pipStatus !== "PA" && pipStatus !== "PIP")) return null;

  const isPIP  = pipStatus === "PIP";
  const colors = isPIP
    ? "bg-red-100 text-red-700 ring-red-300"
    : "bg-amber-100 text-amber-700 ring-amber-300";

  const dateRange = pipFromDate && pipToDate
    ? `${pipFromDate} – ${pipToDate}`
    : null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-1 ${colors} ${className}`}
      title={dateRange ? `${pipStatus}: ${dateRange}` : pipStatus}
    >
      {isPIP ? "🔴" : "🟡"} {pipStatus}
      {dateRange && <span className="font-normal opacity-70">{dateRange}</span>}
    </span>
  );
}
