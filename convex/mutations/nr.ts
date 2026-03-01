import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const upsertNRByEmpId = internalMutation({
  args: {
    empId: v.string(),
    month: v.number(),
    year: v.number(),
    nrValue: v.number(),
    isPositive: v.boolean(),
    source: v.union(v.literal("RMS"), v.literal("Manual")),
  },
  handler: async (ctx, args) => {
    const matchedNJ = await ctx.db
      .query("newJoiners")
      .withIndex("by_emp_id", (q) => q.eq("empId", args.empId))
      .first();
    if (!matchedNJ) return;

    const existing = await ctx.db
      .query("nrRecords")
      .withIndex("by_nj_month_year", (q) =>
        q.eq("njId", matchedNJ._id).eq("year", args.year).eq("month", args.month)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        nrValue: args.nrValue,
        isPositive: args.isPositive,
        source: args.source,
      });
    } else {
      await ctx.db.insert("nrRecords", {
        njId: matchedNJ._id,
        month: args.month,
        year: args.year,
        nrValue: args.nrValue,
        isPositive: args.isPositive,
        source: args.source,
      });
    }
  },
});

export const upsertNR = internalMutation({
  args: {
    njId: v.string(),
    month: v.number(),
    year: v.number(),
    nrValue: v.number(),
    isPositive: v.boolean(),
    source: v.union(v.literal("RMS"), v.literal("Manual")),
  },
  handler: async (ctx, args) => {
    const nj = await ctx.db.query("newJoiners").collect();
    const matchedNJ = nj.find((n) => n.name === args.njId);
    if (!matchedNJ) return;

    const existing = await ctx.db
      .query("nrRecords")
      .withIndex("by_nj_month_year", (q) =>
        q.eq("njId", matchedNJ._id).eq("year", args.year).eq("month", args.month)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        nrValue: args.nrValue,
        isPositive: args.isPositive,
        source: args.source,
      });
    } else {
      await ctx.db.insert("nrRecords", {
        njId: matchedNJ._id,
        month: args.month,
        year: args.year,
        nrValue: args.nrValue,
        isPositive: args.isPositive,
        source: args.source,
      });
    }
  },
});
