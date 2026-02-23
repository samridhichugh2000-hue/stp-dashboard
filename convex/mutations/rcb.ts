import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const upsertRCB = internalMutation({
  args: {
    njId: v.string(),
    corporateName: v.string(),
    claimDate: v.string(),
    status: v.union(
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Rejected"),
      v.literal("Under Review")
    ),
    revenueLinked: v.number(),
  },
  handler: async (ctx, args) => {
    const nj = await ctx.db.query("newJoiners").collect();
    const matchedNJ = nj.find((n) => n.name === args.njId);
    if (!matchedNJ) return;

    // Upsert by njId + corporateName + claimDate
    const existing = await ctx.db
      .query("rcbClaims")
      .withIndex("by_nj", (q) => q.eq("njId", matchedNJ._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("corporateName"), args.corporateName),
          q.eq(q.field("claimDate"), args.claimDate)
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        revenueLinked: args.revenueLinked,
      });
    } else {
      await ctx.db.insert("rcbClaims", {
        njId: matchedNJ._id,
        corporateName: args.corporateName,
        claimDate: args.claimDate,
        status: args.status,
        revenueLinked: args.revenueLinked,
      });
    }
  },
});
