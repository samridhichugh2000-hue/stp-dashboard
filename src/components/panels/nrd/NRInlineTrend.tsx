"use client";
import { NRTrendChart } from "@/components/panels/nrd/NRTrendChart";

export function NRInlineTrend({ njId, njName }: { njId: string; njName: string }) {
  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4">
      <p className="text-xs font-semibold text-indigo-700 mb-3">
        NR Trend — {njName}
      </p>
      <NRTrendChart njId={Number(njId)} njName={njName} />
    </div>
  );
}
