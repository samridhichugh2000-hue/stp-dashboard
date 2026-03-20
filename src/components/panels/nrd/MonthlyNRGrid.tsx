"use client";
import { Fragment, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { fmtTenure } from "@/lib/formatTenure";
import { NRInlineTrend } from "@/components/panels/nrd/NRInlineTrend";
interface NRRecord { id?: number; njId:string; month:number; year:number; nrValue:number; isPositive:boolean; }
interface MonthlyNRGridProps {
  records: NRRecord[];
  months: string[];
  njIds: string[];
  njNames: Record<string,string>;
  njJoinDates?: Record<string,string>;  // "YYYY-MM-DD"
  njTenures?: Record<string,number>;    // months
  filter?: string;
  selectedNjId?: string;
  onSelect?: (njId: string) => void;
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


export function MonthlyNRGrid({ records, months, njIds, njNames, njJoinDates, njTenures, filter, selectedNjId, onSelect }: MonthlyNRGridProps) {
  const topBarRef   = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const mirrorRef   = useRef<HTMLDivElement>(null);
  const scrollLock  = useRef(false);

  // Keep the mirror div width equal to the table's scroll width so the top scrollbar matches.
  useEffect(() => {
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    const sync = () => { if (mirrorRef.current) mirrorRef.current.style.width = `${wrap.scrollWidth}px`; };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    return () => ro.disconnect();
  });

  const onTopScroll = () => {
    if (scrollLock.current) { scrollLock.current = false; return; }
    scrollLock.current = true;
    if (tableWrapRef.current && topBarRef.current) tableWrapRef.current.scrollLeft = topBarRef.current.scrollLeft;
  };
  const onBottomScroll = () => {
    if (scrollLock.current) { scrollLock.current = false; return; }
    scrollLock.current = true;
    if (topBarRef.current && tableWrapRef.current) topBarRef.current.scrollLeft = tableWrapRef.current.scrollLeft;
  };

  const njsWithData = new Set(records.map(r => r.njId));

  const visibleIds = njIds
    .filter(id => {
      if (!filter) return true;
      return (njNames[id] ?? "").toLowerCase().includes(filter.toLowerCase());
    })
    .sort((a, b) => {
      const aDate = njJoinDates?.[a] ?? "";
      const bDate = njJoinDates?.[b] ?? "";
      return bDate.localeCompare(aDate); // latest join date first
    });

  const withDataCount = visibleIds.filter(id => njsWithData.has(id)).length;

  return (
    <div>
      {filter !== undefined && (
        <p className="text-[11px] text-gray-400 mb-2">
          {withDataCount} of {visibleIds.length} shown have NR data
        </p>
      )}
      {/* Top scrollbar mirror — stays in sync with the table below */}
      <div ref={topBarRef} className="overflow-x-auto" onScroll={onTopScroll}>
        <div ref={mirrorRef} style={{ height: 1 }} />
      </div>

      <div ref={tableWrapRef} className="overflow-x-auto" onScroll={onBottomScroll}>
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
            {visibleIds.map(njId => {
              const isSelected = selectedNjId === njId;
              return (
              <Fragment key={njId}>
                <tr className={clsx(
                  "transition-colors group",
                  isSelected ? "bg-indigo-50" : "hover:bg-indigo-50/30",
                  !njsWithData.has(njId) && "opacity-40"
                )}>
                  <td className={clsx(
                    "py-2.5 px-3 sticky left-0 z-10 transition-colors whitespace-nowrap",
                    isSelected ? "bg-indigo-50" : "bg-white group-hover:bg-indigo-50/30"
                  )}>
                    <button
                      onClick={() => onSelect?.(isSelected ? "" : njId)}
                      className="text-left w-full cursor-pointer flex items-center gap-2"
                    >
                      <div className={clsx(
                        "w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                        isSelected
                          ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                          : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                      )}>
                        {(njNames[njId] ?? njId).split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <p className={clsx(
                          "font-semibold",
                          isSelected ? "text-indigo-700" : "text-gray-700 hover:text-indigo-600"
                        )}>
                          {njNames[njId] ?? njId}
                          {isSelected && <span className="ml-1.5 text-[9px] font-bold text-indigo-400 uppercase tracking-wider">▲</span>}
                        </p>
                        {njJoinDates?.[njId] && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{fmtTenure(njJoinDates[njId])}</p>
                        )}
                      </div>
                    </button>
                  </td>
                  {months.map(m => {
                    const [yr, mo] = m.split("-").map(Number);

                    if (isBeforeJoin(njJoinDates?.[njId], yr, mo)) {
                      return <td key={m} className="py-2.5 px-2 bg-gray-50/40" />;
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

                {isSelected && (
                  <tr>
                    <td colSpan={months.length + 1} className="px-4 pb-4 pt-2 bg-indigo-50/60">
                      <NRInlineTrend njId={njId} njName={njNames[njId] ?? njId} />
                    </td>
                  </tr>
                )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
