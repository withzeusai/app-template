import { ConvexError, v } from "convex/values";
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
 * The signed-in user's public fields, or `null` when signed out. Throws
 * `NOT_FOUND` if `/auth/callback` failed to create their row (see
 * `src/pages/auth/Callback.tsx`). Return only what the UI shows: the row's
 * `tokenIdentifier` and email stay on the server.
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({ _id: v.id("users"), name: v.optional(v.string()) }),
    v.null(),
  ),
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
        code: "NOT_FOUND",
        message:
          "The signed-in user has no account record yet. Sign out and sign in again.",
      });
    }
    return { _id: user._id, name: user.name };
  },
});
