import { query } from "../_generated/server";
import { v } from "convex/values";

export const byNJ = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("leads")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
  },
});

export const tatBreached = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("leads")
      .withIndex("by_tat_breached", (q) => q.eq("tatBreached", true))
      .collect();
  },
});

export const summary = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("leads")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();

    const byStatus = all.reduce(
      (acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total: all.length,
      byStatus,
      tatBreached: all.filter((l) => l.tatBreached).length,
      selfGenerated: all.filter((l) => l.isSelfGen).length,
      avgTatHours:
        all.length > 0 ? Math.round(all.reduce((s, l) => s + l.tatHours, 0) / all.length) : 0,
    };
  },
});
