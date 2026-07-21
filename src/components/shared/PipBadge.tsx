"use client";

interface PipBadgeProps {
  pipStatus: string | null | undefined;
  pipFirstSeenAt?: string | null;
  className?: string;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const start = new Date(iso);
  const now = new Date();
  // Calendar days difference (ignoring time-of-day)
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowDay   = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowDay - startDay) / 86_400_000);
}

export function PipBadge({ pipStatus, pipFirstSeenAt, className = "" }: PipBadgeProps) {
  if (!pipStatus || (pipStatus !== "PA" && pipStatus !== "PIP")) return null;

  const days   = daysSince(pipFirstSeenAt);
  const isPIP  = pipStatus === "PIP";
  const colors = isPIP
    ? "bg-red-100 text-red-700 ring-red-300"
    : "bg-amber-100 text-amber-700 ring-amber-300";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ring-1 ${colors} ${className}`}
      title={days != null ? `On ${pipStatus} for ${days} day${days !== 1 ? "s" : ""}` : pipStatus}
    >
      {isPIP ? "🔴" : "🟡"} {pipStatus}
      {days != null && <span className="font-normal opacity-70">{days}d</span>}
    </span>
  );
}
