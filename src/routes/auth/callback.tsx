import { handleCallbackRoute } from "@usehercules/auth-tanstack";
import { createFileRoute } from "@tanstack/react-router";
import { syncCurrentUser } from "@/lib/sync-current-user.ts";

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      // Store the user in the Convex `users` table before the redirect into
      // the app, so user-specific queries and mutations find their row.
      GET: handleCallbackRoute({
        onSuccess: ({ idToken }) => syncCurrentUser(idToken),
      }),
    },
  },
});
