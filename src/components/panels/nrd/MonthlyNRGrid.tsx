"use client";
import { clsx } from "clsx";
interface NRRecord { _id:string; njId:string; month:number; year:number; nrValue:number; isPositive:boolean; }
interface MonthlyNRGridProps { records: NRRecord[]; months: string[]; njIds: string[]; njNames: Record<string,string>; }

/** Exact number with Indian comma grouping: 437096 → 4,37,096 */
function formatINR(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("en-IN")}`;
}

/** "2025-08" → "Aug '25" */
function fmtMonth(key: string): string {
  const [y, m] = key.split("-");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MONTHS[parseInt(m) - 1]} '${y.slice(2)}`;
}

export function MonthlyNRGrid({ records, months, njIds, njNames }: MonthlyNRGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 font-medium text-gray-500 min-w-[180px] sticky left-0 bg-white z-10">
              CSM Name
            </th>
            {months.map(m => (
              <th key={m} className="text-center py-2 px-2 font-medium text-gray-500 min-w-[110px]">
                {fmtMonth(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {njIds.map(njId => (
            <tr key={njId} className="hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10">
                {njNames[njId] ?? njId}
              </td>
              {months.map(m => {
                const [yr, mo] = m.split("-").map(Number);
                const rec = records.find(r => r.njId === njId && r.year === yr && r.month === mo);
                if (!rec) {
                  return (
                    <td key={m} className="py-2 px-2 text-center">
                      <span className="text-gray-400 font-medium">NA</span>
                    </td>
                  );
                }
                return (
                  <td key={m} className="py-2 px-2 text-center">
                    <span className={clsx(
                      "inline-block text-xs font-semibold px-2 py-1 rounded whitespace-nowrap",
                      rec.isPositive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    )}>
                      {formatINR(rec.nrValue)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
