"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getClient } from "../rms/index";

export const syncLeads = internalAction({
  args: {},
  handler: async (ctx) => {
    const module = "leads";
    const startedAt = new Date().toISOString();

    try {
      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module,
        status: "running",
        lastSyncAt: startedAt,
      });

      const client = getClient();
      const records = await client.fetchLeads();

      let count = 0;
      for (const record of records) {
        await ctx.runMutation(internal.mutations.leads.upsertLead, {
          njId: record.njId,
          leadId: record.leadId,
          allocatedDate: record.allocatedDate,
          lastActionDate: record.lastActionDate,
          status: record.status,
          tatHours: record.tatHours,
          tatBreached: record.tatBreached,
          isSelfGen: record.isSelfGen,
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
