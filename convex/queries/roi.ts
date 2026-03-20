import { query } from "../_generated/server";

/**
 * Current ROI summary per CSM.
 * Reads summed NR values from nrRecords (live Koenig CCE NR API).
 */
export const currentROISummary = query({
  args: {},
  handler: async (ctx) => {
    const nrRecords = await ctx.db.query("nrRecords").collect();
    const njs = await ctx.db
      .query("newJoiners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const totals = new Map<string, number>();
    for (const r of nrRecords) {
      totals.set(r.njId, (totals.get(r.njId) ?? 0) + r.nrValue);
    }

    return [...njs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nj) => ({
        _id: nj._id,
        name: nj.name,
        designation: nj.designation,
        tenureMonths: nj.tenureMonths,
        joinDate: nj.joinDate,
        managerId: nj.managerId,
        totalNR: totals.has(nj._id) ? totals.get(nj._id)! : null,
      }));
  },
});

/**
 * Monthly status grid for the "ROI Status of CSMs" page.
 * Reads directly from nrRecords so each cell shows the exact monthly NR value.
 * Missing months are returned as-is (absent from records), letting the UI show "NA".
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

    // Pre-compute grid: { [njId]: { [monthKey]: nrValue } } — avoids sending raw records
    const grid: Record<string, Record<string, number>> = {};
    for (const r of nrRecords) {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      if (!grid[r.njId]) grid[r.njId] = {};
      grid[r.njId][key] = r.nrValue;
    }

    // Sort NJs alphabetically, return only fields needed for display
    const sortedNJs = [...njs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nj) => ({
        _id: nj._id,
        name: nj.name,
        designation: nj.designation,
        tenureMonths: nj.tenureMonths,
        joinDate: nj.joinDate,
      }));

    return { grid, months, njs: sortedNJs };
  },
});

