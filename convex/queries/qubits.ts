import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const byNJ = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("qubitScores")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .order("desc")
      .collect();
  },
});

export const recent7Days = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const all = await ctx.db
      .query("qubitScores")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();

    return all.filter((r) => r.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const alertsBelow50 = query({
  args: {},
  handler: async (ctx) => {
    // Get yesterday's scores below 50
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    const all = await ctx.db.query("qubitScores").collect();
    return all
      .filter((r) => r.date === dateStr && r.score < 50)
      .sort((a, b) => a.score - b.score);
  },
});
