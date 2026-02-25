import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Upsert a New Joiner from Google Sheets.
 * Matches on empId; inserts if not found, patches if found.
 */
export const upsertNewJoiner = internalMutation({
  args: {
    empId: v.string(),
    name: v.string(),
    department: v.optional(v.string()),
    designation: v.optional(v.string()),
    managerName: v.string(),
    location: v.optional(v.string()),
    email: v.optional(v.string()),
    joinDate: v.string(),
    tenureMonths: v.number(),
    currentPhase: v.union(
      v.literal("Orientation"),
      v.literal("Training"),
      v.literal("Field"),
      v.literal("Graduated")
    ),
    category: v.union(
      v.literal("Developed"),
      v.literal("Performer"),
      v.literal("Performance Falling"),
      v.literal("Non-Performer"),
      v.literal("Uncategorised")
    ),
    claimedCorporates: v.optional(v.number()),
    nrFromCorporates: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newJoiners")
      .withIndex("by_emp_id", (q) => q.eq("empId", args.empId))
      .first();

    const fields = {
      name: args.name,
      empId: args.empId,
      department: args.department,
      designation: args.designation,
      managerId: args.managerName,
      location: args.location,
      email: args.email,
      joinDate: args.joinDate,
      tenureMonths: args.tenureMonths,
      currentPhase: args.currentPhase,
      category: args.category,
      isActive: true,
      claimedCorporates: args.claimedCorporates,
      nrFromCorporates: args.nrFromCorporates,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("newJoiners", fields);
    }
  },
});

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
