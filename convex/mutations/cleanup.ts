import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

function isGarbageManagerId(managerId: string): boolean {
  // Convex doc IDs: 25+ chars, no spaces, only a-z and 0-9
  return managerId.length >= 25 && !/\s/.test(managerId) && /^[a-zA-Z0-9]+$/.test(managerId);
}

/**
 * Immediately deactivates all NJs whose managerId is a garbage Convex document ID
 * or whose empId is a mock ID. Call this from the Convex dashboard to clean up now.
 */
export const deactivateGarbageNJs = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("newJoiners").collect();
    let count = 0;
    for (const nj of all) {
      const isGarbage =
        isGarbageManagerId(nj.managerId) ||
        (nj.empId != null && nj.empId.startsWith("MOCK-"));
      if (isGarbage && nj.isActive) {
        await ctx.db.patch(nj._id, { isActive: false });
        count++;
      }
    }
    return { deactivated: count };
  },
});

/**
 * Deletes a single NJ and ALL records linked to them across every table.
 */
export const deleteNJAndAllRecords = internalMutation({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, { njId }) => {
    // Delete NR records
    const nrRecords = await ctx.db
      .query("nrRecords")
      .withIndex("by_nj", (q) => q.eq("njId", njId))
      .collect();
    for (const r of nrRecords) await ctx.db.delete(r._id);

    // Delete ROI records
    const roiRecords = await ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", njId))
      .collect();
    for (const r of roiRecords) await ctx.db.delete(r._id);

    // Delete RCB claims
    const rcbClaims = await ctx.db
      .query("rcbClaims")
      .withIndex("by_nj", (q) => q.eq("njId", njId))
      .collect();
    for (const r of rcbClaims) await ctx.db.delete(r._id);

    // Delete qubit scores
    const qubits = await ctx.db
      .query("qubitScores")
      .withIndex("by_nj", (q) => q.eq("njId", njId))
      .collect();
    for (const r of qubits) await ctx.db.delete(r._id);

    // Delete leads
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_nj", (q) => q.eq("njId", njId))
      .collect();
    for (const r of leads) await ctx.db.delete(r._id);

    // Delete performance alerts
    const alerts = await ctx.db
      .query("performanceAlerts")
      .withIndex("by_nj", (q) => q.eq("njId", njId))
      .collect();
    for (const r of alerts) await ctx.db.delete(r._id);

    // Delete huddle logs
    const huddles = await ctx.db
      .query("huddleLogs")
      .withIndex("by_nj", (q) => q.eq("njId", njId))
      .collect();
    for (const r of huddles) await ctx.db.delete(r._id);

    // Delete assessment checklists
    const checklists = await ctx.db
      .query("assessmentChecklists")
      .withIndex("by_nj", (q) => q.eq("njId", njId))
      .collect();
    for (const r of checklists) await ctx.db.delete(r._id);

    // Finally delete the NJ itself
    await ctx.db.delete(njId);
  },
});
