import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const upsertQubit = internalMutation({
  args: {
    njId: v.string(),
    date: v.string(),
    score: v.number(),
    category: v.string(),
    recordingsCompleted: v.number(),
  },
  handler: async (ctx, args) => {
    // Find NJ by mock ID (name match) or direct ID
    const nj = await ctx.db.query("newJoiners").collect();
    const matchedNJ = nj.find((n) => n.name === args.njId);
    if (!matchedNJ) return; // NJ not yet seeded

    const existing = await ctx.db
      .query("qubitScores")
      .withIndex("by_nj_date", (q) => q.eq("njId", matchedNJ._id).eq("date", args.date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        score: args.score,
        category: args.category,
        recordingsCompleted: args.recordingsCompleted,
      });
    } else {
      await ctx.db.insert("qubitScores", {
        njId: matchedNJ._id,
        date: args.date,
        score: args.score,
        category: args.category,
        recordingsCompleted: args.recordingsCompleted,
      });
    }
  },
});
