import { query } from "../_generated/server";

/** Returns the currently authenticated user's name and role, or null if not signed in. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) return null;
    return { name: user.name, role: user.role, email: user.email };
  },
});
