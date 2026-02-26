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
        let roiStatus: "Positive" | "Negative" | null = null;

        if (records.length > 0) {
          const latest = records.sort((a, b) =>
            a.year !== b.year ? b.year - a.year : b.month - a.month
          )[0];
          nrStatus = latest.isPositive ? "Positive" : "Negative";

          const total = records.reduce((s, r) => s + r.nrValue, 0);
          roiStatus = total > 0 ? "Positive" : "Negative";
        }

        return {
          _id: nj._id,
          name: nj.name,
          designation: nj.designation,
          tenureMonths: nj.tenureMonths,
          nrStatus,
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
