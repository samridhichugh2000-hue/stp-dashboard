import { query } from "../_generated/server";
import { v } from "convex/values";

export const byNJ = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("huddleLogs")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
    return records.sort((a, b) => b.date.localeCompare(a.date));
  },
});
