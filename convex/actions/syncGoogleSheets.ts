"use node";
/**
 * Sync action for Google Sheets integration.
 * Syncs ROI and RCB records only. NJ sync is now handled by syncCSMFromAPI.
 *
 * Run once manually via Convex dashboard, or let the cron fire every hour.
 * Set env vars in Convex:
 *   npx convex env set GOOGLE_SHEET_ID <your-sheet-id>
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { GoogleSheetsRMSClient } from "../rms/googleSheetsClient";

const MODULE = "sheets";

export const syncGoogleSheets = internalAction({
  args: {},
  handler: async (ctx) => {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error(
        "GOOGLE_SHEET_ID is not set. Run: npx convex env set GOOGLE_SHEET_ID <id>"
      );
    }

    const client = new GoogleSheetsRMSClient(sheetId);
    let count = 0;

    await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
      module: MODULE,
      status: "running",
      lastSyncAt: new Date().toISOString(),
    });

    try {
      // ── 1. Upsert ROI Records ──────────────────────────────────────────────
      // Note: NJ sync is handled by syncCSMFromAPI; NR sync by syncNRFromAPI.
      const roiRecords = await client.fetchROI();
      for (const r of roiRecords) {
        await ctx.runMutation(internal.mutations.roi.upsertROI, {
          njId: r.njId,
          weekStart: r.weekStart,
          roiValue: r.roiValue,
          colorCode: r.colorCode,
        });
        count++;
      }

      // ── 2. Upsert RCB Records ──────────────────────────────────────────────
      const rcbRecords = await client.fetchRCB();
      for (const r of rcbRecords) {
        await ctx.runMutation(internal.mutations.rcb.upsertRCB, {
          njId: r.njId,
          corporateName: r.corporateName,
          claimDate: r.claimDate,
          status: r.status,
          revenueLinked: r.revenueLinked,
        });
        count++;
      }

      // ── 3. Re-evaluate categories based on fresh ROI data ────────────────
      await ctx.runAction(internal.actions.evaluateCategories.evaluateCategories, {});

      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module: MODULE,
        status: "success",
        lastSyncAt: new Date().toISOString(),
        recordsProcessed: count,
      });
    } catch (err) {
      await ctx.runMutation(internal.mutations.syncLogs.upsertLog, {
        module: MODULE,
        status: "error",
        lastSyncAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
});
