import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/** Returns true if this NJ record is real API data (not mock/garbage). */
function isValidNJ(nj: { managerId: string; empId?: string | null }): boolean {
  // Real CSMs always have an empId from the Koenig API — reject if missing
  if (!nj.empId) return false;
  // Reject mock empIds seeded by MockRMSClient
  if (nj.empId.startsWith("MOCK-")) return false;
  // Reject records whose managerId is a Convex document ID (garbage from old syncs)
  // Convex IDs: 25+ chars, no spaces, all lowercase alphanumeric
  if (nj.managerId.length >= 25 && !nj.managerId.includes(" ") && /^[a-z0-9]+$/.test(nj.managerId)) return false;
  return true;
}

export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("newJoiners").collect();
    const valid = all.filter(isValidNJ);
    return args.includeInactive ? valid : valid.filter((nj) => nj.isActive);
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
