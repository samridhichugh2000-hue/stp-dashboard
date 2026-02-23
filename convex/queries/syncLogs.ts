import { query } from "../_generated/server";

export const latestByModule = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("syncLogs").collect();
    const modules = [...new Set(all.map((l) => l.module))];
    return modules.map((mod) => {
      const logs = all.filter((l) => l.module === mod).sort((a, b) => b.lastSyncAt.localeCompare(a.lastSyncAt));
      return logs[0];
    }).filter((x): x is (typeof all)[0] => x !== undefined);
  },
});
