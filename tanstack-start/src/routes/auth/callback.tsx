import { handleCallbackRoute } from "@usehercules/auth-tanstack";
import { createFileRoute } from "@tanstack/react-router";
import { syncCurrentUser } from "@/lib/sync-current-user.ts";

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      // Creates the user's Convex row before redirecting into the app.
      GET: handleCallbackRoute({
        onSuccess: ({ idToken }) => syncCurrentUser(idToken),
      }),
      ANY: () =>
        new Response(null, { status: 405, headers: { allow: "GET, HEAD" } }),
    },
  },
});
