import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/** Returns the currently authenticated user's name and role, or null if not signed in. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    // Convex Auth sets subject as "<userId>|<sessionId>" — extract the user ID
    const userId = identity.subject.split("|")[0] as Id<"users">;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { name: user.name, role: user.role, email: user.email };
  },
});
