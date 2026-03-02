import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** Upsert per-CSM RCB summary from the live Koenig API. Matches NJ by empId. */
export const upsertRCBSummary = internalMutation({
  args: {
    empId: v.string(),
    claimedCorporates: v.number(),
    nrFromCorporates: v.number(),
    noOfClients: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const nj = await ctx.db
      .query("newJoiners")
      .withIndex("by_emp_id", (q) => q.eq("empId", args.empId))
      .first();
    if (!nj) {
      console.log(`[upsertRCBSummary] No NJ found for empId ${args.empId}`);
      return;
    }

    const existing = await ctx.db
      .query("rcbSummary")
      .withIndex("by_nj", (q) => q.eq("njId", nj._id))
      .first();

    const payload = {
      claimedCorporates: args.claimedCorporates,
      nrFromCorporates: args.nrFromCorporates,
      noOfClients: args.noOfClients,
      lastSyncAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("rcbSummary", { njId: nj._id, ...payload });
    }
  },
});

const statusArgs = v.union(
  v.literal("Pending"),
  v.literal("Approved"),
  v.literal("Rejected"),
  v.literal("Under Review")
);

export const upsertRCB = internalMutation({
  args: {
    njId: v.string(),
    corporateName: v.string(),
    claimDate: v.string(),
    status: statusArgs,
    revenueLinked: v.number(),
  },
  handler: async (ctx, args) => {
    const nj = await ctx.db.query("newJoiners").collect();
    const matchedNJ = nj.find((n) => n.name === args.njId);
    if (!matchedNJ) return;

    const existing = await ctx.db
      .query("rcbClaims")
      .withIndex("by_nj", (q) => q.eq("njId", matchedNJ._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("corporateName"), args.corporateName),
          q.eq(q.field("claimDate"), args.claimDate)
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        revenueLinked: args.revenueLinked,
      });
    } else {
      await ctx.db.insert("rcbClaims", {
        njId: matchedNJ._id,
        corporateName: args.corporateName,
        claimDate: args.claimDate,
        status: args.status,
        revenueLinked: args.revenueLinked,
      });
    }
  },
});

/** Match NJ by empId (from live API). Used by syncRCBFromAPI. */
export const upsertRCBByEmpId = internalMutation({
  args: {
    empId: v.string(),
    corporateName: v.string(),
    claimDate: v.string(),
    status: statusArgs,
    revenueLinked: v.number(),
  },
  handler: async (ctx, args) => {
    const nj = await ctx.db
      .query("newJoiners")
      .withIndex("by_emp_id", (q) => q.eq("empId", args.empId))
      .first();
    if (!nj) {
      console.log(`[upsertRCBByEmpId] No NJ found for empId ${args.empId}`);
      return;
    }

    const existing = await ctx.db
      .query("rcbClaims")
      .withIndex("by_nj", (q) => q.eq("njId", nj._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("corporateName"), args.corporateName),
          q.eq(q.field("claimDate"), args.claimDate)
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        revenueLinked: args.revenueLinked,
      });
    } else {
      await ctx.db.insert("rcbClaims", {
        njId: nj._id,
        corporateName: args.corporateName,
        claimDate: args.claimDate,
        status: args.status,
        revenueLinked: args.revenueLinked,
      });
    }
  },
});
