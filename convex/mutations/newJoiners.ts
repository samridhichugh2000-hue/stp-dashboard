import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const updateCategory = internalMutation({
  args: {
    njId: v.id("newJoiners"),
    category: v.union(
      v.literal("Developed"),
      v.literal("Performer"),
      v.literal("Performance Falling"),
      v.literal("Non-Performer"),
      v.literal("Uncategorised")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.njId, { category: args.category });
  },
});

export const updateTenure = internalMutation({
  args: {
    njId: v.id("newJoiners"),
    tenureMonths: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.njId, { tenureMonths: args.tenureMonths });
  },
});

export const updatePhase = mutation({
  args: {
    njId: v.id("newJoiners"),
    phase: v.union(
      v.literal("Orientation"),
      v.literal("Training"),
      v.literal("Field"),
      v.literal("Graduated")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.njId, { currentPhase: args.phase });
  },
});
