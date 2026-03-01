"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

type Category = "Developed" | "Performer" | "Performance Falling" | "Non-Performer" | "Uncategorised";

export const evaluateCategories = internalAction({
  args: {},
  handler: async (ctx) => {
    const njs = await ctx.runQuery(internal.queries.newJoiners.listAllInternal, {});

    for (const nj of njs) {
      if (!nj.isActive) continue;

      const nrHistory = await ctx.runQuery(internal.queries.nr.byNJInternal, { njId: nj._id });

      if (nrHistory.length === 0) continue; // No NR data → leave Uncategorised

      // Sort by recency
      const sortedNR = [...nrHistory].sort((a, b) =>
        b.year !== a.year ? b.year - a.year : b.month - a.month
      );

      const lastNR = sortedNR[0];

      // Latest NR positive
      const latestNRPositive = lastNR?.isPositive ?? false;

      // NR positive within first 4 tenure months
      const joinDate  = new Date(nj.joinDate);
      const joinYear  = joinDate.getFullYear();
      const joinMonth = joinDate.getMonth() + 1;
      const nrPositiveEarly = nrHistory.some((r) => {
        const tenureMonth = (r.year - joinYear) * 12 + (r.month - joinMonth);
        return r.isPositive && tenureMonth >= 1 && tenureMonth <= 4;
      });

      const nrPositive = latestNRPositive || nrPositiveEarly;

      // ROI = total NR sum — same source as NRD section (Koenig CCE NR API)
      const totalNR    = nrHistory.reduce((s, r) => s + r.nrValue, 0);
      const roiPositive = totalNR > 0;

      // Only two categories: Developed (both positive) or Non-Performer (either negative)
      const category: Category = nrPositive && roiPositive ? "Developed" : "Non-Performer";

      await ctx.runMutation(internal.mutations.newJoiners.updateCategory, {
        njId: nj._id,
        category,
      });
    }
  },
});
