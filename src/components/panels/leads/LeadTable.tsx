"use client";
import { clsx } from "clsx";
import { format } from "date-fns";
import { TATBadge } from "./TATBadge";
interface Lead { _id: string; leadId: string; allocatedDate: string; lastActionDate: string; status: string; tatHours: number; tatBreached: boolean; isSelfGen: boolean; }
const STATUS_CLASSES: Record<string,string> = { New:"bg-blue-100 text-blue-800", Contacted:"bg-indigo-100 text-indigo-800", Qualified:"bg-purple-100 text-purple-800", Proposal:"bg-amber-100 text-amber-800", Won:"bg-emerald-100 text-emerald-800", Lost:"bg-red-100 text-red-800", Stale:"bg-gray-100 text-gray-600" };
export function LeadTable({ leads }: { leads: Lead[] }) {
  if (!leads.length) return <div className="text-center py-8 text-sm text-gray-400">No leads found</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-100">
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Lead ID</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Allocated</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Last Action</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">TAT</th>
          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Type</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map(lead => (
            <tr key={lead._id} className="hover:bg-gray-50">
              <td className="py-2 px-3 font-mono text-xs text-gray-600">{lead.leadId}</td>
              <td className="py-2 px-3 text-gray-600">{format(new Date(lead.allocatedDate), "dd MMM")}</td>
              <td className="py-2 px-3 text-gray-600">{format(new Date(lead.lastActionDate), "dd MMM")}</td>
              <td className="py-2 px-3"><span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_CLASSES[lead.status] ?? "bg-gray-100 text-gray-600")}>{lead.status}</span></td>
              <td className="py-2 px-3"><TATBadge tatHours={lead.tatHours} tatBreached={lead.tatBreached} /></td>
              <td className="py-2 px-3 text-xs text-gray-500">{lead.isSelfGen ? "Self-gen" : "Allocated"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
