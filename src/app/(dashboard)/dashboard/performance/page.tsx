"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { clsx } from "clsx";
import {
  PieChart, Pie, Cell, Legend, ResponsiveContainer, Sector,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

type NRROIStatus = "Positive" | "Negative" | null;

function fmtTenure(months: number): string {
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} mo`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yr} yr ${mo} mo` : `${yr} yr`;
}

function computeDev(nrStatus: NRROIStatus, roiStatus: NRROIStatus): boolean | null {
  if (!nrStatus && !roiStatus) return null;
  return nrStatus === "Positive" && roiStatus === "Positive";
}

function computeAction(nrStatus: NRROIStatus, roiStatus: NRROIStatus, tenureMonths: number): string | null {
  if (!nrStatus && !roiStatus) return null;
  const hasIssue = nrStatus !== "Positive" || roiStatus !== "Positive";
  if (!hasIssue) return "On Track";
  return tenureMonths > 4 ? "PA/PIP Suggested" : "Under Observation";
}

function NRROIBadge({ status }: { status: NRROIStatus }) {
  if (!status) return <span className="text-gray-300 text-xs select-none">—</span>;
  return (
    <span className={clsx(
      "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg",
      status === "Positive"
        ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/60"
        : "bg-red-100 text-red-700 ring-1 ring-red-200/60"
    )}>
      {status}
    </span>
  );
}

function StatusBadge({ dev, tenure }: { dev: boolean | null; tenure: number }) {
  if (dev === null) return <span className="text-gray-300 text-xs select-none">—</span>;
  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span className={clsx(
        "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap",
        dev
          ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/60"
          : "bg-pink-100 text-pink-700 ring-1 ring-pink-200/60"
      )}>
        {dev ? "Developed" : "Not Developed"}
      </span>
      <span className="text-[10px] text-gray-400">within {fmtTenure(tenure)}</span>
    </div>
  );
}

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-gray-300 text-xs select-none">—</span>;
  const styles: Record<string, string> = {
    "On Track":           "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60",
    "Under Observation":  "bg-amber-50 text-amber-600 ring-1 ring-amber-200/60",
    "PA/PIP Suggested":   "bg-rose-100 text-rose-700 ring-1 ring-rose-200/60",
  };
  return (
    <span className={clsx(
      "inline-block text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap",
      styles[action] ?? "bg-gray-100 text-gray-600"
    )}>
      {action}
    </span>
  );
}

const renderActiveShape = (props: Record<string, number & string>) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 18} textAnchor="middle" fill="#374151" fontSize={13} fontWeight="600">
        {(payload as unknown as { name: string }).name}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#111827" fontSize={26} fontWeight="800">
        {value as unknown as number}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#9ca3af" fontSize={12}>
        {`${((percent as unknown as number) * 100).toFixed(1)}% of CSMs`}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={(outerRadius as unknown as number) + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={(outerRadius as unknown as number) + 10}
        outerRadius={(outerRadius as unknown as number) + 14}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function PerformancePage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const rows = useQuery(api.queries.performance.njPerformanceStatus);

  const enriched = rows?.map(row => ({
    ...row,
    dev: computeDev(row.nrStatus, row.roiStatus),
    suggestedAction: computeAction(row.nrStatus, row.roiStatus, row.tenureMonths),
  }));

  const developedRows    = enriched?.filter(r => r.dev === true)  ?? [];
  const notDevelopedRows = enriched?.filter(r => r.dev === false) ?? [];
  const noDataRows       = enriched?.filter(r => r.dev === null)  ?? [];

  const devCount    = developedRows.length;
  const notDevCount = notDevelopedRows.length;
  const underObs    = enriched?.filter(r => r.suggestedAction === "Under Observation").length ?? 0;
  const pipCount    = enriched?.filter(r => r.suggestedAction === "PA/PIP Suggested").length ?? 0;

  const statCards = [
    { label: "Developed",         value: devCount,    desc: "Both NR & ROI positive",      bg: "from-indigo-400 to-violet-500" },
    { label: "Not Developed",     value: notDevCount, desc: "NR or ROI negative",           bg: "from-pink-400 to-rose-500" },
    { label: "Under Observation", value: underObs,    desc: "Negative within 4 months",     bg: "from-purple-400 to-indigo-500" },
    { label: "PA/PIP Suggested",  value: pipCount,    desc: "Negative beyond 4 months",     bg: "from-rose-500 to-red-600" },
  ];

  // Pie chart
  const pieData = [
    { name: "Developed",     value: devCount,    color: "#a5b4fc" },
    { name: "Not Developed", value: notDevCount, color: "#f9a8d4" },
  ].filter(d => d.value > 0);

  // Bar chart by tenure group
  const tenureGroups = [
    { name: "≤ 2 mo",  Developed: 0, "Not Developed": 0 },
    { name: "3–4 mo",  Developed: 0, "Not Developed": 0 },
    { name: "> 4 mo",  Developed: 0, "Not Developed": 0 },
  ];
  enriched?.forEach(r => {
    if (r.dev === null) return;
    const bucket = r.tenureMonths <= 2 ? 0 : r.tenureMonths <= 4 ? 1 : 2;
    if (r.dev) tenureGroups[bucket].Developed++;
    else tenureGroups[bucket]["Not Developed"]++;
  });

  function renderRow(
    row: NonNullable<typeof enriched>[number],
    serial: number,
    hoverClass: string
  ) {
    return (
      <tr key={row._id} className={clsx("transition-colors group", hoverClass)}>
        <td className="py-2.5 px-3 text-xs text-gray-300">{serial}</td>
        <td className="py-2.5 px-3 text-xs font-semibold text-gray-800 group-hover:text-gray-900">{row.name}</td>
        <td className="py-2.5 px-3 text-xs text-gray-400">{fmtTenure(row.tenureMonths)}</td>
        <td className="py-2.5 px-3 text-center"><NRROIBadge status={row.nrStatus} /></td>
        <td className="py-2.5 px-3 text-center"><NRROIBadge status={row.roiStatus} /></td>
        <td className="py-2.5 px-3 text-center"><StatusBadge dev={row.dev} tenure={row.tenureMonths} /></td>
        <td className="py-2.5 px-3 text-center"><ActionBadge action={row.suggestedAction} /></td>
        <td className="py-2.5 px-3 text-right text-xs font-semibold text-gray-700 tabular-nums">
          {row.claimedCorporates > 0 ? row.claimedCorporates : <span className="text-gray-300">—</span>}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NJ Performance Status</h1>
        <p className="text-sm text-gray-500 mt-0.5">Development status, suggested actions and corporate claims per CSM</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {statCards.map((c) => (
          <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white shadow-lg card-hover`}>
            <div className="text-xs font-medium text-white/70 mb-2">{c.label}</div>
            <div className="text-4xl font-black">
              {rows ? c.value : <span className="text-white/40">—</span>}
            </div>
            <div className="text-xs text-white/60 mt-1">{c.desc}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut — Developed vs Not Developed */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Development Distribution</h2>
          <p className="text-xs text-gray-400 mb-2">Hover over a segment to explore</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  {...{ activeIndex: activeIdx }}
                  activeShape={renderActiveShape as never}
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={88}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIdx(index)}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="white" strokeWidth={3} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={10}
                  formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grouped bar — Status by tenure bucket */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Status by Tenure Group</h2>
          <p className="text-xs text-gray-400 mb-2">Developed vs Not Developed across tenure buckets</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tenureGroups} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                  cursor={{ fill: "#f9fafb" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={9}
                  formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                />
                <Bar dataKey="Developed"     fill="#a5b4fc" radius={[5, 5, 0, 0]} />
                <Bar dataKey="Not Developed" fill="#f9a8d4" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">CSM Performance Breakdown</h2>
        {rows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gray-50/60">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">CSM Name</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">Tenure</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">NR Status</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">ROI Status</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">Suggested Action</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">Corporates Claimed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">

                {/* ── Developed section ── */}
                {developedRows.length > 0 && (
                  <tr>
                    <td colSpan={8} className="py-2 px-3 bg-indigo-50/60">
                      <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">
                        Developed ({developedRows.length})
                      </span>
                    </td>
                  </tr>
                )}
                {developedRows.map((row, i) =>
                  renderRow(row, i + 1, "hover:bg-indigo-50/30")
                )}

                {/* ── Not Developed section ── */}
                {notDevelopedRows.length > 0 && (
                  <tr>
                    <td colSpan={8} className="py-2 px-3 bg-pink-50/60">
                      <span className="text-xs font-bold text-pink-500 uppercase tracking-wider">
                        Not Developed ({notDevelopedRows.length})
                      </span>
                    </td>
                  </tr>
                )}
                {notDevelopedRows.map((row, i) =>
                  renderRow(row, developedRows.length + i + 1, "hover:bg-pink-50/20")
                )}

                {/* ── No data rows ── */}
                {noDataRows.map((row, i) =>
                  renderRow(row, developedRows.length + notDevelopedRows.length + i + 1, "hover:bg-gray-50")
                )}

              </tbody>
            </table>
          </div>
        ) : (
          <div className="animate-pulse h-64 bg-gray-50 rounded-xl" />
        )}
      </div>
    </div>
  );
}
