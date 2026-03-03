import { query } from "../_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const faqs = await ctx.db.query("faqs").collect();
    return faqs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  },
});
