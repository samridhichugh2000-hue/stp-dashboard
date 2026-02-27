"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { getClient } from "../rms/index";

export const searchROI = action({
  args: {
    fromDate: v.string(), // DD-MMM-YYYY e.g. "01-Jan-2026"
    toDate: v.string(),
  },
  handler: async (_ctx, args) => {
    const client = getClient();
    const records = await client.fetchROI(args.fromDate, args.toDate);
    return records.map((r) => ({
      cceName: r.njId,
      leads: r.leads ?? 0,
      registrations: r.registrations ?? 0,
      conversionRate: r.conversionRate ?? 0,
      roiValue: r.roiValue,
      fromDate: r.fromDate ?? args.fromDate,
      toDate: r.toDate ?? args.toDate,
    }));
  },
});
