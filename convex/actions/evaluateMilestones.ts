"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const evaluateMilestones = internalAction({
  args: {},
  handler: async (ctx) => {
    const njs = await ctx.runQuery(internal.queries.newJoiners.listAllInternal, {});
    const today = new Date().toISOString().split("T")[0];

    for (const nj of njs) {
      if (!nj.isActive) continue;

      const joinDate = new Date(nj.joinDate);
      const todayDate = new Date(today);
      const tenureMs = todayDate.getTime() - joinDate.getTime();
      const tenureMonths = Math.floor(tenureMs / (1000 * 60 * 60 * 24 * 30));

      // Update tenureMonths
      await ctx.runMutation(internal.mutations.newJoiners.updateTenure, {
        njId: nj._id,
        tenureMonths,
      });

      // PA alert: >= 3 months
      if (tenureMonths >= 3) {
        await ctx.runMutation(internal.mutations.performanceAlerts.ensureAlert, {
          njId: nj._id,
          alertType: "PA",
          triggeredAt: new Date().toISOString(),
        });
      }

      // Fetch last month NR once — reused for both PIP and EXIT checks
      const lastMonthNR = tenureMonths >= 4
        ? await ctx.runQuery(internal.queries.nr.lastMonthForNJ, { njId: nj._id })
        : null;

      // PIP alert: >= 4 months AND last month NR negative
      if (tenureMonths >= 4 && lastMonthNR && !lastMonthNR.isPositive) {
        await ctx.runMutation(internal.mutations.performanceAlerts.ensureAlert, {
          njId: nj._id,
          alertType: "PIP",
          triggeredAt: new Date().toISOString(),
        });
      }

      // EXIT alert: >= 5 months AND NR negative
      if (tenureMonths >= 5 && lastMonthNR && !lastMonthNR.isPositive) {
        await ctx.runMutation(internal.mutations.performanceAlerts.ensureAlert, {
          njId: nj._id,
          alertType: "EXIT",
          triggeredAt: new Date().toISOString(),
        });
      }
    }
  },
});
