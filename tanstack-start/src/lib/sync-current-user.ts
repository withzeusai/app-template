import { api } from "@/convex/_generated/api.js";
import { publicConvexClient } from "./convex-server.ts";

// Long enough to ride out a dropped connection, short enough that the
// sign-in redirect does not visibly stall.
const RETRY_DELAY_MS = 500;

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
 * A failed call is retried once. If the retry fails too, the error is logged
 * and sign-in still completes; `api.users.getCurrentUser` then throws
 * `USER_NOT_FOUND` for that user instead of returning `null`, so the missing
 * row shows up as an error rather than an app that looks empty. Signing in
 * again runs the sync again.
 */
export async function syncCurrentUser(
  idToken: string | undefined,
  { retryDelayMs = RETRY_DELAY_MS }: { retryDelayMs?: number } = {},
): Promise<void> {
  // Convex authenticates with the ID token; without one there is no identity
  // to store (and no Convex auth for the session either).
  if (!idToken) {
    return;
  }
  try {
    await storeUser(idToken);
  } catch (firstError) {
    console.warn(
      "Failed to sync the signed-in user to Convex, retrying:",
      firstError,
    );
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    try {
      await storeUser(idToken);
    } catch (error) {
      console.error("Failed to sync the signed-in user to Convex:", error);
    }
  }
}

async function storeUser(idToken: string): Promise<void> {
  const client = publicConvexClient();
  client.setAuth(idToken);
  await client.mutation(api.users.updateCurrentUser, {});
}
