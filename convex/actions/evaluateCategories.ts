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
      const roiHistory = await ctx.runQuery(internal.queries.roi.byNJInternal, { njId: nj._id });

      if (nrHistory.length === 0 && roiHistory.length === 0) continue;

      // Sort by recency
      const sortedNR = [...nrHistory].sort((a, b) =>
        b.year !== a.year ? b.year - a.year : b.month - a.month
      );
      const sortedROI = [...roiHistory].sort((a, b) =>
        b.weekStart > a.weekStart ? 1 : -1
      );

      const lastNR = sortedNR[0];
      const lastROI = sortedROI[0];

      const nrPositive = lastNR?.isPositive ?? false;
      const roiPositive = lastROI?.colorCode === "Green" || lastROI?.colorCode === "Black";

      // Check alternating NR pattern (2+ months)
      const nrAlternating =
        sortedNR.length >= 2 &&
        sortedNR[0].isPositive !== sortedNR[1].isPositive;

      let category: Category = "Uncategorised";

      if (nrPositive && roiPositive) {
        category = "Developed";
      } else if (nrPositive || roiPositive) {
        category = "Performer";
      } else if (nrAlternating) {
        category = "Performance Falling";
      } else if (!nrPositive && !roiPositive) {
        category = "Non-Performer";
      }

      await ctx.runMutation(internal.mutations.newJoiners.updateCategory, {
        njId: nj._id,
        category,
      });
    }
  },
});
