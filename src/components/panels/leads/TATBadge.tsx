"use client";
import { clsx } from "clsx";
interface TATBadgeProps { tatHours: number; tatBreached: boolean; }
export function TATBadge({ tatHours, tatBreached }: TATBadgeProps) {
  return (
    <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", tatBreached ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800")}>
      {tatBreached ? "Breached" : "On time"} · {tatHours}h
    </span>
  );
}
