import { query } from "../_generated/server";

export const njPerformanceStatus = query({
  args: {},
  handler: async (ctx) => {
    const njs = await ctx.db
      .query("newJoiners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const allNR = await ctx.db.query("nrRecords").collect();

    return [...njs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nj) => {
        const records = allNR.filter((r) => r.njId === nj._id);
        let nrStatus: "Positive" | "Negative" | null = null;
        let nrPositiveMonth: number | null = null; // earliest tenure month (1–4) where NR was positive
        let roiStatus: "Positive" | "Negative" | null = null;

        if (records.length > 0) {
          // Latest NR status
          const latest = [...records].sort((a, b) =>
            a.year !== b.year ? b.year - a.year : b.month - a.month
          )[0];
          nrStatus = latest.isPositive ? "Positive" : "Negative";

          // Total NR → ROI
          const total = records.reduce((s, r) => s + r.nrValue, 0);
          roiStatus = total > 0 ? "Positive" : "Negative";

          // Find earliest month within first 4 tenure months where NR was positive
          const joinDate = new Date(nj.joinDate);
          const joinYear = joinDate.getFullYear();
          const joinMonth = joinDate.getMonth() + 1; // 1-indexed

          const positiveEarly = records
            .map((r) => ({
              ...r,
              tenureMonth: (r.year - joinYear) * 12 + (r.month - joinMonth),
            }))
            .filter((r) => r.isPositive && r.tenureMonth >= 1 && r.tenureMonth <= 4)
            .sort((a, b) => a.tenureMonth - b.tenureMonth);

          if (positiveEarly.length > 0) {
            nrPositiveMonth = positiveEarly[0].tenureMonth;
          }
        }

        return {
          _id: nj._id,
          name: nj.name,
          designation: nj.designation,
          tenureMonths: nj.tenureMonths,
          nrStatus,
          nrPositiveMonth,
          roiStatus,
          claimedCorporates: nj.claimedCorporates ?? 0,
        };
      });
  },
});

// Aggregate KPI summary for the overview stat cards
export const dashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const njs = await ctx.db.query("newJoiners").filter((q) => q.eq(q.field("isActive"), true)).collect();
    const allAlerts = await ctx.db.query("performanceAlerts").collect();
    const pendingAlerts = allAlerts.filter((a) => !a.acknowledgedAt);
    const allLeads = await ctx.db.query("leads").collect();
    const allScores = await ctx.db.query("qubitScores").collect();

    const tatBreached = allLeads.filter((l) => l.tatBreached).length;
    const avgScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((s, q) => s + q.score, 0) / allScores.length)
        : 0;

    const byPhase = njs.reduce((acc, nj) => {
      acc[nj.currentPhase] = (acc[nj.currentPhase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      activeNJs: njs.length,
      pendingAlerts: pendingAlerts.length,
      totalLeads: allLeads.length,
      tatBreached,
      avgQubitScore: avgScore,
      byPhase,
    };
  },
});

export const categoryTable = query({
  args: {},
  handler: async (ctx) => {
    const njs = await ctx.db.query("newJoiners").filter((q) => q.eq(q.field("isActive"), true)).collect();

    const categories = ["Developed", "Performer", "Performance Falling", "Non-Performer", "Uncategorised"];
    return categories.map((cat) => ({
      category: cat,
      count: njs.filter((nj) => nj.category === cat).length,
      njs: njs.filter((nj) => nj.category === cat),
    }));
  },
});

export const pendingAlerts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("performanceAlerts").collect();
    return all.filter((a) => !a.acknowledgedAt);
  },
});
