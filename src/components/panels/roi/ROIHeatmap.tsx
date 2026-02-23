"use client";
import { clsx } from "clsx";
interface ROIRecord { njId:string; weekStart:string; roiValue:number; colorCode:string; }
interface ROIHeatmapProps { records: ROIRecord[]; weekStarts: string[]; njIds: string[]; njNames: Record<string,string>; }
const COLOR_CLASSES: Record<string,{bg:string;text:string;label:string}> = {
  Green:{bg:"bg-emerald-100",text:"text-emerald-800",label:"Green"},
  Black:{bg:"bg-gray-800",text:"text-gray-100",label:"Black"},
  Yellow:{bg:"bg-amber-100",text:"text-amber-800",label:"Yellow"},
  Red:{bg:"bg-red-100",text:"text-red-800",label:"Red"},
};
export function ROIHeatmap({ records, weekStarts, njIds, njNames }: ROIHeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="border-b border-gray-100">
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 w-32">NJ</th>
          {weekStarts.map(w=><th key={w} className="text-center py-2 px-3 text-xs font-medium text-gray-500">{new Date(w).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {njIds.map(njId=>(
            <tr key={njId} className="hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-700 text-xs">{njNames[njId]??njId}</td>
              {weekStarts.map(w=>{
                const rec=records.find(r=>r.njId===njId&&r.weekStart===w);
                if(!rec) return <td key={w} className="py-2 px-3 text-center text-gray-300 text-xs">—</td>;
                const c=COLOR_CLASSES[rec.colorCode]??{bg:"bg-gray-100",text:"text-gray-600",label:rec.colorCode};
                return <td key={w} className="py-2 px-3 text-center">
                  <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full",c.bg,c.text)} aria-label={`ROI ${rec.roiValue} - ${c.label}`}>{rec.roiValue}%</span>
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
        {Object.entries(COLOR_CLASSES).map(([key,c])=>(
          <span key={key} className="flex items-center gap-1"><span className={clsx("w-3 h-3 rounded-full",c.bg,"border border-gray-200")} aria-hidden/>{c.label}</span>
        ))}
      </div>
    </div>
  );
}
