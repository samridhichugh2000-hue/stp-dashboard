import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const upsertLog = internalMutation({
  args: {
    module: v.string(),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("running")),
    lastSyncAt: v.string(),
    errorMessage: v.optional(v.string()),
    recordsProcessed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncLogs")
      .withIndex("by_module", (q) => q.eq("module", args.module))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        lastSyncAt: args.lastSyncAt,
        errorMessage: args.errorMessage,
        recordsProcessed: args.recordsProcessed,
      });
    } else {
      await ctx.db.insert("syncLogs", {
        module: args.module,
        status: args.status,
        lastSyncAt: args.lastSyncAt,
        errorMessage: args.errorMessage,
        recordsProcessed: args.recordsProcessed,
      });
    }
  },
});
