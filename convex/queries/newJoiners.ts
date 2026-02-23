import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("newJoiners").collect();
    return args.includeInactive ? all : all.filter((nj) => nj.isActive);
  },
});

export const getById = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.njId);
  },
});

// Internal query — no auth — used by cron actions
export const listAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("newJoiners").collect();
  },
});
