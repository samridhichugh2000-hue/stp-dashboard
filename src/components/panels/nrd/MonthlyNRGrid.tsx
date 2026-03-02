"use client";
import { clsx } from "clsx";
interface NRRecord { _id:string; njId:string; month:number; year:number; nrValue:number; isPositive:boolean; }
interface MonthlyNRGridProps {
  records: NRRecord[];
  months: string[];
  njIds: string[];
  njNames: Record<string,string>;
  njJoinDates?: Record<string,string>;  // "YYYY-MM-DD"
  njTenures?: Record<string,number>;    // months
  filter?: string;
}

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

/** True if the column month/year is strictly before the NJ's join month. */
function isBeforeJoin(joinDateISO: string | undefined, colYear: number, colMonth: number): boolean {
  if (!joinDateISO) return false;
  const d = new Date(joinDateISO);
  const jYear = d.getFullYear();
  const jMonth = d.getMonth() + 1;
  return colYear < jYear || (colYear === jYear && colMonth < jMonth);
}

function formatTenure(months: number): string {
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yrs}y ${mo}mo` : `${yrs}y`;
}

export function MonthlyNRGrid({ records, months, njIds, njNames, njJoinDates, njTenures, filter }: MonthlyNRGridProps) {
  const njsWithData = new Set(records.map(r => r.njId));

  const visibleIds = njIds
    .filter(id => {
      if (!filter) return true;
      return (njNames[id] ?? "").toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => {
      const aHas = njsWithData.has(a);
      const bHas = njsWithData.has(b);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return (njNames[a] ?? "").localeCompare(njNames[b] ?? "");
    });

  const withDataCount = visibleIds.filter(id => njsWithData.has(id)).length;

  return (
    <div>
      {filter !== undefined && (
        <p className="text-[11px] text-gray-400 mb-2">
          {withDataCount} of {visibleIds.length} shown have NR data
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-100 bg-gray-50/60">
              <th className="text-left py-2.5 px-3 font-semibold text-gray-500 min-w-[180px] sticky left-0 bg-gray-50/90 z-10">
                CSM Name
              </th>
              {months.map(m => (
                <th key={m} className="text-center py-2.5 px-2 font-semibold text-gray-500 min-w-[110px]">
                  {fmtMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibleIds.length === 0 && (
              <tr>
                <td colSpan={months.length + 1} className="py-8 text-center text-xs text-gray-400">
                  No results
                </td>
              </tr>
            )}
            {visibleIds.map(njId => (
              <tr key={njId} className={clsx("hover:bg-indigo-50/30 transition-colors group", !njsWithData.has(njId) && "opacity-40")}>
                <td className="py-2.5 px-3 sticky left-0 bg-white group-hover:bg-indigo-50/30 z-10 transition-colors whitespace-nowrap">
                  <p className="font-semibold text-gray-700">{njNames[njId] ?? njId}</p>
                  {njTenures?.[njId] !== undefined && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatTenure(njTenures[njId])}</p>
                  )}
                </td>
                {months.map(m => {
                  const [yr, mo] = m.split("-").map(Number);

                  // Blank out months before the NJ joined
                  if (isBeforeJoin(njJoinDates?.[njId], yr, mo)) {
                    return (
                      <td key={m} className="py-2.5 px-2 bg-gray-50/40" />
                    );
                  }

                  const rec = records.find(r => r.njId === njId && r.year === yr && r.month === mo);
                  if (!rec) {
                    return (
                      <td key={m} className="py-2.5 px-2 text-center">
                        <span className="text-gray-200 text-xs select-none">—</span>
                      </td>
                    );
                  }
                  return (
                    <td key={m} className="py-2.5 px-2 text-center">
                      <span className={clsx(
                        "inline-block text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap",
                        rec.isPositive
                          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/60"
                          : "bg-red-100 text-red-700 ring-1 ring-red-200/60"
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
    </div>
  );
}
