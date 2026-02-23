/**
 * Convex Auth configuration.
 * Uses Password provider for email + password login.
 * Role is stored in the `users` table and resolved via the users query.
 */
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }
      // Create new user with default viewer role
      return ctx.db.insert("users", {
        name: args.profile.name ?? args.profile.email ?? "Unknown",
        email: args.profile.email ?? "",
        role: "viewer",
      });
    },
  },
});
