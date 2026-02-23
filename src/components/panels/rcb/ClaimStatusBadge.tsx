"use client";
import { clsx } from "clsx";
type Status = "Pending"|"Approved"|"Rejected"|"Under Review";
const STATUS_CLASSES: Record<Status,string> = {
  Pending:"bg-amber-100 text-amber-800",
  Approved:"bg-emerald-100 text-emerald-800",
  Rejected:"bg-red-100 text-red-800",
  "Under Review":"bg-blue-100 text-blue-800",
};
export function ClaimStatusBadge({ status }: { status: Status }) {
  return <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full",STATUS_CLASSES[status]??"bg-gray-100 text-gray-600")} role="status" aria-label={`Status: ${status}`}>{status}</span>;
}
