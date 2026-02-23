"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;       // e.g. "from-indigo-500 to-violet-600"
  trend?: { value: number; label: string };
  prefix?: string;
  suffix?: string;
  animationDelay?: number;
}

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      function step(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return count;
}

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  gradient,
  trend,
  prefix = "",
  suffix = "",
  animationDelay = 0,
}: StatCardProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(String(value));
  const isNumeric = !isNaN(numericValue);
  const displayCount = useCountUp(isNumeric ? numericValue : 0, 1000, animationDelay + 200);

  const displayValue = isNumeric
    ? `${prefix}${displayCount.toLocaleString("en-IN")}${suffix}`
    : `${prefix}${value}${suffix}`;

  const trendPositive = trend && trend.value >= 0;

  return (
    <div
      className="animate-slide-up card-hover bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Top gradient strip */}
      <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1 count-up">{displayValue}</p>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div
            className={clsx(
              "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br",
              gradient
            )}
          >
            {icon}
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-1.5">
            <span
              className={clsx(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                trendPositive
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              )}
            >
              {trendPositive ? "▲" : "▼"} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-gray-400">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
