import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Upsert a New Joiner from the CSM API.
 * Matches on empId; inserts if not found, patches if found.
 */
export const upsertNewJoiner = internalMutation({
  args: {
    empId: v.string(),
    name: v.string(),
    department: v.optional(v.string()),
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
    category: v.optional(v.union(
      v.literal("Developed"),
      v.literal("Performer"),
      v.literal("Performance Falling"),
      v.literal("Non-Performer"),
      v.literal("Uncategorised")
    )),
    designation: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newJoiners")
      .withIndex("by_emp_id", (q) => q.eq("empId", args.empId))
      .first();

    const baseFields = {
      name: args.name,
      empId: args.empId,
      department: args.department,
      managerId: args.managerName,
      location: args.location,
      email: args.email,
      joinDate: args.joinDate,
      tenureMonths: args.tenureMonths,
      currentPhase: args.currentPhase,
      isActive: args.isActive ?? true,
      designation: args.designation,
    };

    if (existing) {
      // Only overwrite category if explicitly provided; preserve existing otherwise
      const patch = args.category !== undefined
        ? { ...baseFields, category: args.category }
        : baseFields;
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("newJoiners", {
        ...baseFields,
        category: args.category ?? "Uncategorised",
      });
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

/**
 * Deactivate all currently-active NJs whose empId is NOT in the provided list.
 * Called after a full API sync to mark removed CSMs as inactive.
 */
export const deactivateNJsExcept = internalMutation({
  args: { empIds: v.array(v.string()) },
  handler: async (ctx, { empIds }) => {
    const empIdSet = new Set(empIds);
    const allActive = await ctx.db
      .query("newJoiners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    for (const nj of allActive) {
      if (nj.empId && !empIdSet.has(nj.empId)) {
        await ctx.db.patch(nj._id, { isActive: false });
      }
    }
  },
});
