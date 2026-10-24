import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      return user._id;
    }
    // If it's a new identity, create a new User.
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

/**
 * The signed-in user's row, or `null` for a signed-out visitor, so a loader
 * that calls this still server-renders for them.
 *
 * `/auth/callback` creates the row before the redirect into the app (see
 * `src/lib/sync-current-user.ts`), so a signed-in user without one means that
 * sync failed. That throws `USER_NOT_FOUND` instead of returning `null`, so
 * the failure shows up rather than leaving the app looking empty. Signing in
 * again runs the sync again.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user === null) {
      throw new ConvexError({
        code: "USER_NOT_FOUND",
        message:
          "The signed-in user has no account record yet. Sign out and sign in again.",
      });
    }
    return user;
  },
});
