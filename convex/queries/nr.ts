import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const byNJ = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("nrRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
    return records.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  },
});

export const byNJInternal = internalQuery({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("nrRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
  },
});

export const monthlyGrid = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("nrRecords").collect();
    // Newest month first (Feb 2026, Jan 2026, Dec 2025 …)
    const months = [...new Set(all.map((r) => `${r.year}-${String(r.month).padStart(2, "0")}`))]
      .sort()
      .reverse();

    return { records: all, months };
  },
});

export const performingCount = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const all = await ctx.db.query("nrRecords").collect();
    const thisMonth = all.filter((r) => r.month === month && r.year === year);
    return {
      performing: thisMonth.filter((r) => r.isPositive).length,
      nonPerforming: thisMonth.filter((r) => !r.isPositive).length,
      total: thisMonth.length,
    };
  },
});

export const nrdStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("nrRecords").collect();
    const njs = await ctx.db
      .query("newJoiners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    let totalPositive = 0, totalNegative = 0, positiveWithin4 = 0, negativeAfter4 = 0;

    for (const nj of njs) {
      const njRecords = all.filter((r) => r.njId === nj._id);
      if (njRecords.length === 0) continue;
      // Most recent month's record
      const latest = njRecords.sort((a, b) =>
        a.year !== b.year ? b.year - a.year : b.month - a.month
      )[0];
      if (latest.isPositive) {
        totalPositive++;
        if (nj.tenureMonths <= 4) positiveWithin4++;
      } else {
        totalNegative++;
        if (nj.tenureMonths > 4) negativeAfter4++;
      }
    }
    return { totalPositive, totalNegative, positiveWithin4, negativeAfter4 };
  },
});

export const lastMonthForNJ = internalQuery({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const today = new Date();
    const lastMonth = today.getMonth() === 0 ? 12 : today.getMonth();
    const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();

    const records = await ctx.db
      .query("nrRecords")
      .withIndex("by_nj_month_year", (q) =>
        q.eq("njId", args.njId).eq("year", year).eq("month", lastMonth)
      )
      .first();

    return records;
  },
});
