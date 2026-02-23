"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getClient } from "../rms/index";

export const syncNR = internalAction({
  args: {},
  handler: async (ctx) => {
    const module = "nr";
    const startedAt = new Date().toISOString();

    try {
      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module,
        status: "running",
        lastSyncAt: startedAt,
      });

      const client = getClient();
      const records = await client.fetchNR();

      let count = 0;
      for (const record of records) {
        await ctx.runMutation(internal.mutations.nr.upsertNR, {
          njId: record.njId,
          month: record.month,
          year: record.year,
          nrValue: record.nrValue,
          isPositive: record.isPositive,
          source: record.source,
        });
        count++;
      }

      // After NR sync, evaluate categories
      await ctx.runAction(internal.actions.evaluateCategories.evaluateCategories, {});

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
