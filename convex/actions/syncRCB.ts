"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getClient } from "../rms/index";

export const syncRCB = internalAction({
  args: {},
  handler: async (ctx) => {
    const module = "rcb";
    const startedAt = new Date().toISOString();

    try {
      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module,
        status: "running",
        lastSyncAt: startedAt,
      });

      const client = getClient();
      const records = await client.fetchRCB();

      let count = 0;
      for (const record of records) {
        await ctx.runMutation(internal.mutations.rcb.upsertRCB, {
          njId: record.njId,
          corporateName: record.corporateName,
          claimDate: record.claimDate,
          status: record.status,
          revenueLinked: record.revenueLinked,
        });
        count++;
      }

      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module,
        status: "success",
        lastSyncAt: new Date().toISOString(),
        recordsProcessed: count,
      });
    } catch (err) {
      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module,
        status: "error",
        lastSyncAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
});
