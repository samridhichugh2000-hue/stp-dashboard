import { query } from "../_generated/server";
import { v } from "convex/values";

/** Per-CSM corporate summary — sourced from rcbSummary (live Koenig API sync). */
export const allCorpSummary = query({
  args: {},
  handler: async (ctx) => {
    const njs = await ctx.db
      .query("newJoiners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const allSummaries = await ctx.db.query("rcbSummary").collect();

    const summaryByNJ = new Map(allSummaries.map((s) => [s.njId as string, s]));

    return [...njs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nj) => {
        const s = summaryByNJ.get(nj._id as string);
        return {
          _id: nj._id,
          empId: nj.empId ?? null,
          name: nj.name,
          designation: nj.designation,
          tenureMonths: nj.tenureMonths,
          joinDate: nj.joinDate,
          claimedCorporates: s?.claimedCorporates ?? 0,
          nrFromCorporates: s?.nrFromCorporates ?? 0,
        };
      });
  },
});

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
