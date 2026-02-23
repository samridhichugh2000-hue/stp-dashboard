import { query } from "../_generated/server";
import { v } from "convex/values";

export const byNJ = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("rcbClaims")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
  },
});

export const claimSummary = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("rcbClaims")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();

    const byStatus = all.reduce(
      (acc, claim) => {
        acc[claim.status] = (acc[claim.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalRevenue = all
      .filter((c) => c.status === "Approved")
      .reduce((s, c) => s + c.revenueLinked, 0);

    return {
      total: all.length,
      byStatus,
      totalApprovedRevenue: totalRevenue,
    };
  },
});
