import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const byNJ = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
    return records.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  },
});

export const byNJInternal = internalQuery({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
  },
});

export const weeklyHeatmap = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("roiRecords").collect();
    // Last 8 weeks
    const weekStarts = [...new Set(all.map((r) => r.weekStart))].sort().slice(-8);
    return { records: all, weekStarts };
  },
});

export const consecutiveRedCount = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();

    const sorted = records.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    let count = 0;
    for (const r of sorted) {
      if (r.colorCode === "Red") count++;
      else break;
    }
    return count;
  },
});

export const lastWeekForNJ = internalQuery({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();

    if (records.length === 0) return null;
    return records.sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
  },
});
