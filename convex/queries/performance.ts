import { query } from "../_generated/server";

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
