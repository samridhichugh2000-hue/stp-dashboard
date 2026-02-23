import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const markComplete = mutation({
  args: {
    huddleId: v.id("huddleLogs"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.huddleId, {
      completed: true,
      notes: args.notes,
    });
  },
});

export const create = mutation({
  args: {
    njId: v.id("newJoiners"),
    date: v.string(),
    type: v.union(
      v.literal("Daily"),
      v.literal("Weekly"),
      v.literal("Monthly"),
      v.literal("Ad-hoc")
    ),
    conductedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("huddleLogs", {
      njId: args.njId,
      date: args.date,
      type: args.type,
      conductedBy: args.conductedBy,
      completed: false,
    });
  },
});
