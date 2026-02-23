"use client";
import { FunnelChart, Funnel, Tooltip, LabelList, ResponsiveContainer } from "recharts";
const STAGE_COLORS = ["#3b82f6","#6366f1","#8b5cf6","#f59e0b","#10b981","#ef4444","#9ca3af"];
const STAGES = ["New","Contacted","Qualified","Proposal","Won","Lost","Stale"];
interface PipelineFunnelProps { byStatus: Record<string, number>; }
export function PipelineFunnel({ byStatus }: PipelineFunnelProps) {
  const data = STAGES.map((s,i) => ({ name: s, value: byStatus[s] ?? 0, fill: STAGE_COLORS[i] })).filter(d=>d.value>0);
  if (!data.length) return <div className="text-center py-8 text-sm text-gray-400">No pipeline data</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <FunnelChart>
        <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} />
        <Funnel dataKey="value" data={data} isAnimationActive>
          <LabelList position="right" fill="#4b5563" stroke="none" dataKey="name" style={{fontSize:11}} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}
