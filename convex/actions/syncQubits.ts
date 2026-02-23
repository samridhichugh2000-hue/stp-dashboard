"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getClient } from "../rms/index";

export const syncQubits = internalAction({
  args: {},
  handler: async (ctx) => {
    const module = "qubits";
    const startedAt = new Date().toISOString();

    try {
      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module,
        status: "running",
        lastSyncAt: startedAt,
      });

      const client = getClient();
      const records = await client.fetchQubits();

      let count = 0;
      for (const record of records) {
        await ctx.runMutation(internal.mutations.qubits.upsertQubit, {
          njId: record.njId,
          date: record.date,
          score: record.score,
          category: record.category,
          recordingsCompleted: record.recordingsCompleted,
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
