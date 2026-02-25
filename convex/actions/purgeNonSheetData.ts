"use node";
/**
 * One-time purge: removes all NJs that were NOT imported from Google Sheets
 * (i.e., those without a numeric empId), along with ALL their associated records.
 *
 * Run once: npx convex run actions/purgeNonSheetData:purgeNonSheetData
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const purgeNonSheetData = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all NJs
    const allNJs = await ctx.runQuery(internal.queries.newJoiners.listAllInternal, {});

    // Keep only NJs with a numeric empId (Google Sheets data)
    const mockNJs = allNJs.filter(
      (nj) => !nj.empId || !/^\d+$/.test(nj.empId)
    );

    let removed = { njs: 0, nr: 0, roi: 0, rcb: 0, qubits: 0, leads: 0, alerts: 0, huddles: 0 };

    for (const nj of mockNJs) {
      await ctx.runMutation(internal.mutations.cleanup.deleteNJAndAllRecords, {
        njId: nj._id,
      });
      removed.njs++;
    }

    return {
      message: `Purged ${removed.njs} non-sheet NJs and all their records.`,
      ...removed,
    };
  },
});
