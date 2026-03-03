"use client";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { NRTrendChart } from "@/components/panels/nrd/NRTrendChart";

export function NRInlineTrend({ njId, njName }: { njId: string; njName: string }) {
  const records = useQuery(api.queries.nr.byNJ, { njId: njId as Id<"newJoiners"> });

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4">
      <p className="text-xs font-semibold text-indigo-700 mb-3">
        NR Trend — {njName}
      </p>
      {records === undefined ? (
        <div className="animate-pulse h-48 bg-gray-50 rounded-lg" />
      ) : (
        <NRTrendChart records={records} />
      )}
    </div>
  );
}
