"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
interface NRRecord { month:number; year:number; nrValue:number; isPositive:boolean; }
interface NRTrendChartProps { records: NRRecord[]; }
export function NRTrendChart({ records }: NRTrendChartProps) {
  const data = [...records].sort((a,b)=>a.year!==b.year?a.year-b.year:a.month-b.month).map(r=>({
    label: new Date(r.year,r.month-1).toLocaleDateString("en-IN",{month:"short"}),
    value: r.nrValue,
    positive: r.isPositive,
  }));
  if(!data.length) return <div className="text-center py-8 text-sm text-gray-400">No NR data</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{top:4,right:8,bottom:4,left:-8}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{fontSize:11,fill:"#9ca3af"}} />
        <YAxis
          tick={{fontSize:11,fill:"#9ca3af"}}
          tickFormatter={v => {
            const abs = Math.abs(v);
            const sign = v < 0 ? "-" : "";
            if (abs >= 10_000_000) return `${sign}₹${(abs/10_000_000).toFixed(1)}Cr`;
            if (abs >= 100_000)    return `${sign}₹${(abs/100_000).toFixed(1)}L`;
            if (abs >= 1_000)      return `${sign}₹${(abs/1_000).toFixed(0)}K`;
            return `${sign}₹${abs}`;
          }}
          width={70}
        />
        <Tooltip
          contentStyle={{fontSize:12,borderRadius:8}}
          formatter={(v: unknown) => {
            const n = v as number;
            return [`${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("en-IN")}`, "NR Value"] as [string, string];
          }}
        />
        <ReferenceLine y={0} stroke="#d1d5db" />
        <Bar dataKey="value" radius={[4,4,0,0]}>
          {data.map((d,i)=><Cell key={i} fill={d.positive?"#10b981":"#ef4444"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
