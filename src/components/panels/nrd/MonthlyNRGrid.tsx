"use client";
import { clsx } from "clsx";
interface NRRecord { _id:string; njId:string; month:number; year:number; nrValue:number; isPositive:boolean; }
interface MonthlyNRGridProps { records: NRRecord[]; months: string[]; njIds: string[]; njNames: Record<string,string>; }
function formatINR(v:number){ const abs=Math.abs(v); if(abs>=100000) return `${v<0?"-":""}₹${(abs/100000).toFixed(1)}L`; return `${v<0?"-":""}₹${(abs/1000).toFixed(0)}K`; }
export function MonthlyNRGrid({ records, months, njIds, njNames }: MonthlyNRGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="border-b border-gray-100">
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 w-32">NJ</th>
          {months.map(m=><th key={m} className="text-center py-2 px-3 text-xs font-medium text-gray-500">{new Date(m+"-01").toLocaleDateString("en-IN",{month:"short",year:"2-digit"})}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {njIds.map(njId=>(
            <tr key={njId} className="hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-700 text-xs">{njNames[njId]??njId}</td>
              {months.map(m=>{
                const [yr,mo]=m.split("-").map(Number);
                const rec=records.find(r=>r.njId===njId&&r.year===yr&&r.month===mo);
                if(!rec) return <td key={m} className="py-2 px-3 text-center text-gray-300 text-xs">—</td>;
                return <td key={m} className="py-2 px-3 text-center"><span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full",rec.isPositive?"bg-emerald-100 text-emerald-800":"bg-red-100 text-red-800")}>{formatINR(rec.nrValue)}</span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
