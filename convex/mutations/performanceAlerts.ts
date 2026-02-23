import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Ensure an alert of given type exists (idempotent — won't duplicate)
export const ensureAlert = internalMutation({
  args: {
    njId: v.id("newJoiners"),
    alertType: v.union(v.literal("PA"), v.literal("PIP"), v.literal("EXIT")),
    triggeredAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("performanceAlerts")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .filter((q) => q.eq(q.field("alertType"), args.alertType))
      .first();

    if (!existing) {
      await ctx.db.insert("performanceAlerts", {
        njId: args.njId,
        alertType: args.alertType,
        triggeredAt: args.triggeredAt,
      });
    }
  },
});

// Acknowledge an alert
export const acknowledge = mutation({
  args: {
    alertId: v.id("performanceAlerts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, {
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: "Admin",
    });
  },
});
