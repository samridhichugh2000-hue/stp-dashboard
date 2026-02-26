import { mutation, internalMutation } from "../_generated/server";
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

// Used by Teams sync action — upserts by (njId, date)
export const upsertHuddle = internalMutation({
  args: {
    njId: v.id("newJoiners"),
    date: v.string(),
    completed: v.boolean(),
    conductedBy: v.string(),
    teamsEventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("huddleLogs")
      .withIndex("by_nj_date", (q) => q.eq("njId", args.njId).eq("date", args.date))
      .first();

    if (existing) {
      // Update only if completed status changed or we now have an event ID
      if (existing.completed !== args.completed || (!existing.teamsEventId && args.teamsEventId)) {
        await ctx.db.patch(existing._id, {
          completed: args.completed,
          conductedBy: args.conductedBy,
          teamsEventId: args.teamsEventId,
        });
      }
    } else {
      await ctx.db.insert("huddleLogs", {
        njId: args.njId,
        date: args.date,
        type: "Daily",
        conductedBy: args.conductedBy,
        completed: args.completed,
        teamsEventId: args.teamsEventId,
      });
    }
  },
});
