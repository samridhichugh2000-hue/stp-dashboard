import { query } from "../_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").order("desc").collect();
    return Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: doc.storageId ? await ctx.storage.getUrl(doc.storageId) : null,
      }))
    );
  },
});
