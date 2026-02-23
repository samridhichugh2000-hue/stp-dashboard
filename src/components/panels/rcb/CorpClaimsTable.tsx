"use client";
import { format } from "date-fns";
import { ClaimStatusBadge } from "./ClaimStatusBadge";
type ClaimStatus = "Pending" | "Approved" | "Rejected" | "Under Review";
interface Claim { _id:string; corporateName:string; claimDate:string; status:ClaimStatus; revenueLinked:number; }
function formatINR(v:number){ if(v>=100000) return `₹${(v/100000).toFixed(1)}L`; return `₹${(v/1000).toFixed(0)}K`; }
export function CorpClaimsTable({ claims }: { claims: Claim[] }) {
  if(!claims.length) return <div className="text-center py-8 text-sm text-gray-400">No RCB claims found</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-100">
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Corporate</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Claim Date</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
          <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Revenue</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {claims.map(c=>(
            <tr key={c._id} className="hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-700">{c.corporateName}</td>
              <td className="py-2 px-3 text-gray-600">{format(new Date(c.claimDate),"dd MMM yyyy")}</td>
              <td className="py-2 px-3"><ClaimStatusBadge status={c.status} /></td>
              <td className="py-2 px-3 text-right font-medium text-gray-900">{formatINR(c.revenueLinked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
