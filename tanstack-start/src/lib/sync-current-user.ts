import { api } from "@/convex/_generated/api.js";
import { publicConvexClient } from "./convex-server.ts";

/**
 * Creates the signed-in user's Convex `users` row if it is missing.
 * `/auth/callback` runs this before redirecting into the app. One failure is
 * retried; a second is logged, and `getCurrentUser` then throws
 * `USER_NOT_FOUND` until the user signs in again.
 */
export async function syncCurrentUser(
  idToken: string | undefined,
): Promise<void> {
  if (!idToken) return;
  try {
    await storeUser(idToken);
  } catch (firstError) {
    console.warn(
      "Failed to sync the signed-in user to Convex, retrying:",
      firstError,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
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
