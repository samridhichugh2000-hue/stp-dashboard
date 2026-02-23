import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const upsertROI = internalMutation({
  args: {
    njId: v.string(),
    weekStart: v.string(),
    roiValue: v.number(),
    colorCode: v.union(
      v.literal("Green"),
      v.literal("Black"),
      v.literal("Red"),
      v.literal("Yellow")
    ),
  },
  handler: async (ctx, args) => {
    const nj = await ctx.db.query("newJoiners").collect();
    const matchedNJ = nj.find((n) => n.name === args.njId);
    if (!matchedNJ) return;

    const existing = await ctx.db
      .query("roiRecords")
      .withIndex("by_nj_week", (q) => q.eq("njId", matchedNJ._id).eq("weekStart", args.weekStart))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        roiValue: args.roiValue,
        colorCode: args.colorCode,
      });
    } else {
      await ctx.db.insert("roiRecords", {
        njId: matchedNJ._id,
        weekStart: args.weekStart,
        roiValue: args.roiValue,
        colorCode: args.colorCode,
      });
    }
  },
});
