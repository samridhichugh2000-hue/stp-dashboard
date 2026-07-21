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

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ring-1 ${colors} ${className}`}
    >
      {pipStatus}
      {pipFromDate && pipToDate && (
        <span className="font-normal">{pipFromDate} – {pipToDate}</span>
      )}
    </span>
  );
}
