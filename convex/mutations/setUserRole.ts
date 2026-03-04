import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** One-time utility: set a user's role by email. */
export const setRoleByEmail = internalMutation({
  args: { email: v.string(), role: v.union(v.literal("admin"), v.literal("manager"), v.literal("viewer"), v.literal("nj")) },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").filter(q => q.eq(q.field("email"), args.email)).first();
    if (!user) throw new Error(`No user found with email ${args.email}`);
    await ctx.db.patch(user._id, { role: args.role });
    return { updated: user.email, role: args.role };
  },
});
