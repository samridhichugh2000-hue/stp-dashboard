"use node";
/**
 * Sync action for Google Sheets integration.
 * Reads GOOGLE_SHEET_ID from Convex environment variables.
 *
 * Run once manually via Convex dashboard, or let the cron fire every hour.
 * Set env vars in Convex:
 *   npx convex env set GOOGLE_SHEET_ID <your-sheet-id>
 *   npx convex env set CONVEX_RMS_MODE sheets
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { GoogleSheetsRMSClient } from "../rms/googleSheetsClient";

const MODULE = "sheets";

function tenureMonths(joinDateISO: string): number {
  const join = new Date(joinDateISO);
  const today = new Date();
  return Math.max(
    0,
    (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth())
  );
}

function derivePhase(months: number): "Orientation" | "Training" | "Field" | "Graduated" {
  if (months < 1) return "Orientation";
  if (months < 3) return "Training";
  if (months < 6) return "Field";
  return "Graduated";
}

function deriveCategory(
  status: string
): "Developed" | "Performer" | "Performance Falling" | "Non-Performer" | "Uncategorised" {
  switch (status.toLowerCase().trim()) {
    case "green":  return "Developed";
    case "yellow": return "Performance Falling";
    case "red":    return "Non-Performer";
    default:       return "Uncategorised";
  }
}

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
      // ── 1. Upsert New Joiners ──────────────────────────────────────────────
      const njs = await client.fetchNewJoiners();
      for (const nj of njs) {
        const months = tenureMonths(nj.joinDate);
        await ctx.runMutation(internal.mutations.newJoiners.upsertNewJoiner, {
          empId: nj.empId,
          name: nj.name,
          department: nj.department,
          managerName: nj.managerName,
          location: nj.location,
          email: nj.email,
          joinDate: nj.joinDate,
          tenureMonths: months,
          currentPhase: derivePhase(months),
          category: deriveCategory(nj.status),
        });
        count++;
      }

      // ── 2. Upsert NR Records ───────────────────────────────────────────────
      const nrRecords = await client.fetchNR();
      for (const r of nrRecords) {
        await ctx.runMutation(internal.mutations.nr.upsertNR, {
          njId: r.njId,
          month: r.month,
          year: r.year,
          nrValue: r.nrValue,
          isPositive: r.isPositive,
          source: r.source,
        });
        count++;
      }

      // ── 3. Upsert ROI Records ──────────────────────────────────────────────
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

      // ── 4. Upsert RCB Records ──────────────────────────────────────────────
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

      // ── 5. Re-evaluate categories based on fresh NR/ROI data ─────────────
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
