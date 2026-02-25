"use client";
import { format } from "date-fns";
import { ClaimStatusBadge } from "./ClaimStatusBadge";
type ClaimStatus = "Pending" | "Approved" | "Rejected" | "Under Review";
interface Claim { _id:string; corporateName:string; claimDate:string; status:ClaimStatus; revenueLinked:number; }
function formatINR(v:number){ const sign = v < 0 ? "-" : ""; return `${sign}${Math.abs(v).toLocaleString("en-IN")}`; }
export function CorpClaimsTable({ claims }: { claims: Claim[] }) {
  if(!claims.length) return <div className="text-center py-8 text-sm text-gray-400">No RCB claims found</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-100 bg-gray-50/60">
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">Corporate</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">Claim Date</th>
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400">Status</th>
            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {claims.map(c => (
            <tr key={c._id} className="hover:bg-indigo-50/30 transition-colors group">
              <td className="py-2.5 px-3 font-semibold text-gray-800 group-hover:text-gray-900">{c.corporateName}</td>
              <td className="py-2.5 px-3 text-gray-500">{format(new Date(c.claimDate), "dd MMM yyyy")}</td>
              <td className="py-2.5 px-3"><ClaimStatusBadge status={c.status} /></td>
              <td className="py-2.5 px-3 text-right font-bold text-gray-900 tabular-nums">{formatINR(c.revenueLinked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
