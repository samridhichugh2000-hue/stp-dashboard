import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const submit = mutation({
  args: {
    njId: v.id("newJoiners"),
    managerNotes: v.optional(v.string()),
    hrNotes: v.optional(v.string()),
    outcome: v.union(
      v.literal("Pass"),
      v.literal("Fail"),
      v.literal("Pending"),
      v.literal("Deferred")
    ),
    checklistData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("assessmentChecklists", {
      njId: args.njId,
      filledBy: "Admin",
      filledAt: new Date().toISOString(),
      managerNotes: args.managerNotes,
      hrNotes: args.hrNotes,
      outcome: args.outcome,
      checklistData: args.checklistData,
    });
  },
});
