import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Current ROI summary per CSM.
 * When live API data is present (roiRecords with fromDate/toDate), uses that.
 * Falls back to the sheet's INR total or summed nrRecords otherwise.
 */
export const currentROISummary = query({
  args: {},
  handler: async (ctx) => {
    const nrRecords = await ctx.db.query("nrRecords").collect();
    const roiRecords = await ctx.db.query("roiRecords").collect();
    const njs = await ctx.db
      .query("newJoiners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Sum all monthly NR per NJ (fallback)
    const totals = new Map<string, number>();
    for (const r of nrRecords) {
      totals.set(r.njId, (totals.get(r.njId) ?? 0) + r.nrValue);
    }

    // Latest ROI record per NJ (prefer live-API records that have fromDate)
    const latestRoi = new Map<string, typeof roiRecords[0]>();
    for (const r of roiRecords) {
      const existing = latestRoi.get(r.njId);
      if (!existing || r.weekStart > existing.weekStart) {
        latestRoi.set(r.njId, r);
      }
    }

    return [...njs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nj) => {
        const roi = latestRoi.get(nj._id);
        const fallbackNR = nj.totalNR !== undefined
          ? nj.totalNR
          : (totals.has(nj._id) ? totals.get(nj._id)! : null);
        return {
          _id: nj._id,
          name: nj.name,
          designation: nj.designation,
          tenureMonths: nj.tenureMonths,
          // Prefer live API roiValue when it carries monetary data (has fromDate)
          totalNR: roi?.fromDate ? roi.roiValue : fallbackNR,
          leads: roi?.leads ?? null,
          registrations: roi?.registrations ?? null,
          conversionRate: roi?.conversionRate ?? null,
          fromDate: roi?.fromDate ?? null,
          toDate: roi?.toDate ?? null,
        };
      });
  },
});

/**
 * Monthly status grid for the "ROI Status of CSMs" page.
 * Reads directly from nrRecords so each cell shows the exact value
 * from the Google Sheet. Missing months are returned as-is (absent from
 * records), letting the UI show "NA".
 */
export const monthlyStatusGrid = query({
  args: {},
  handler: async (ctx) => {
    const nrRecords = await ctx.db.query("nrRecords").collect();
    const njs = await ctx.db
      .query("newJoiners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Sorted month keys like "2025-08", "2025-09", …
    const monthSet = new Set(
      nrRecords.map((r) => `${r.year}-${String(r.month).padStart(2, "0")}`)
    );
    const months = [...monthSet].sort();

    // Sort NJs alphabetically
    const sortedNJs = [...njs].sort((a, b) => a.name.localeCompare(b.name));

    return { records: nrRecords, months, njs: sortedNJs };
  },
});

export const byNJ = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
    return records.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  },
});

export const byNJInternal = internalQuery({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();
  },
});

export const weeklyHeatmap = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("roiRecords").collect();
    // Last 8 weeks
    const weekStarts = [...new Set(all.map((r) => r.weekStart))].sort().slice(-8);
    return { records: all, weekStarts };
  },
});

export const consecutiveRedCount = query({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();

    const sorted = records.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    let count = 0;
    for (const r of sorted) {
      if (r.colorCode === "Red") count++;
      else break;
    }
    return count;
  },
});

export const lastWeekForNJ = internalQuery({
  args: { njId: v.id("newJoiners") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("roiRecords")
      .withIndex("by_nj", (q) => q.eq("njId", args.njId))
      .collect();

    if (records.length === 0) return null;
    return records.sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
  },
});
