import { api } from "@/convex/_generated/api.js";
import { publicConvexClient } from "./convex-server.ts";

/**
 * Creates the signed-in user's row in the Convex `users` table if it is
 * missing, by calling `api.users.updateCurrentUser` as that user.
 *
 * `/auth/callback` runs this right after the token exchange, before it sets
 * the session cookie and redirects into the app. The row therefore exists
 * before any server-rendered loader or client query reads it, and the sync
 * happens once per sign-in rather than on every page load. The mutation is an
 * upsert keyed on `tokenIdentifier`, so signing in again is harmless.
 *
 * A failure is logged and never blocks sign-in.
 */
export async function syncCurrentUser(
  idToken: string | undefined,
): Promise<void> {
  // Convex authenticates with the ID token; without one there is no identity
  // to store (and no Convex auth for the session either).
  if (!idToken) {
    return;
  }
  try {
    const client = publicConvexClient();
    client.setAuth(idToken);
    await client.mutation(api.users.updateCurrentUser, {});
  } catch (error) {
    console.error("Failed to sync the signed-in user to Convex:", error);
  }
}
