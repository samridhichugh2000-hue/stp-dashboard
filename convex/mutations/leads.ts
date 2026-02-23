import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const upsertLead = internalMutation({
  args: {
    njId: v.string(),
    leadId: v.string(),
    allocatedDate: v.string(),
    lastActionDate: v.string(),
    status: v.union(
      v.literal("New"),
      v.literal("Contacted"),
      v.literal("Qualified"),
      v.literal("Proposal"),
      v.literal("Won"),
      v.literal("Lost"),
      v.literal("Stale")
    ),
    tatHours: v.number(),
    tatBreached: v.boolean(),
    isSelfGen: v.boolean(),
  },
  handler: async (ctx, args) => {
    const nj = await ctx.db.query("newJoiners").collect();
    const matchedNJ = nj.find((n) => n.name === args.njId);
    if (!matchedNJ) return;

    const existing = await ctx.db
      .query("leads")
      .withIndex("by_lead_id", (q) => q.eq("leadId", args.leadId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastActionDate: args.lastActionDate,
        status: args.status,
        tatHours: args.tatHours,
        tatBreached: args.tatBreached,
      });
    } else {
      await ctx.db.insert("leads", {
        njId: matchedNJ._id,
        leadId: args.leadId,
        allocatedDate: args.allocatedDate,
        lastActionDate: args.lastActionDate,
        status: args.status,
        tatHours: args.tatHours,
        tatBreached: args.tatBreached,
        isSelfGen: args.isSelfGen,
      });
    }
  },
});
