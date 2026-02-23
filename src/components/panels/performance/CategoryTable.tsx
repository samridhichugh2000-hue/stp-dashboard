"use client";

import { clsx } from "clsx";

const CAT_META: Record<string, { badge: string; bar: string; bg: string; icon: string }> = {
  Developed:             { badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500", bg: "bg-emerald-50", icon: "🌟" },
  Performer:             { badge: "bg-blue-100 text-blue-800",       bar: "bg-blue-500",    bg: "bg-blue-50",   icon: "🎯" },
  "Performance Falling": { badge: "bg-amber-100 text-amber-800",     bar: "bg-amber-500",   bg: "bg-amber-50",  icon: "⚠️" },
  "Non-Performer":       { badge: "bg-red-100 text-red-800",         bar: "bg-red-500",     bg: "bg-red-50",    icon: "🔴" },
  Uncategorised:         { badge: "bg-gray-100 text-gray-600",       bar: "bg-gray-400",    bg: "bg-gray-50",   icon: "⬜" },
};

interface CategoryRow {
  category: string;
  count: number;
  njs: Array<{ _id: string; name: string }>;
}

export function CategoryTable({
  rows,
  total,
}: {
  rows: CategoryRow[];
  total: number;
}) {
  return (
    <div className="space-y-4 stagger">
      {rows.map((row) => {
        const meta = CAT_META[row.category] ?? CAT_META.Uncategorised;
        const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;

        return (
          <div
            key={row.category}
            className={clsx(
              "animate-slide-up rounded-xl p-4 border border-transparent transition-all",
              row.count > 0 ? meta.bg : "bg-gray-50"
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{meta.icon}</span>
                <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full", meta.badge)}>
                  {row.category}
                </span>
              </div>
              <span className="text-xl font-bold text-gray-800">{row.count}</span>
            </div>

            {/* Animated progress bar */}
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full ${meta.bar} bar-fill`}
                style={{ "--bar-width": `${pct}%` } as React.CSSProperties}
              />
            </div>

            {/* NJ Pills */}
            <div className="flex flex-wrap gap-1.5">
              {row.njs.map((nj) => (
                <span
                  key={nj._id}
                  className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-0.5 text-gray-700 shadow-xs hover:shadow-sm transition-shadow"
                >
                  {nj.name}
                </span>
              ))}
              {row.count === 0 && (
                <span className="text-xs text-gray-400 italic">No NJs in this category</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
