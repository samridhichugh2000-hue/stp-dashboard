"use client";
import { useState, useEffect } from "react";
import type { NRRecord } from "@/lib/types";
import { NRTrendChart } from "@/components/panels/nrd/NRTrendChart";

export function NRInlineTrend({ njId, njName }: { njId: string; njName: string }) {
  const [records, setRecords] = useState<NRRecord[] | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/nr?q=byNJ&njId=${njId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setRecords(data ?? []); });
  }, [njId]);

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
