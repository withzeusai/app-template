import { handleSignInRoute } from "@usehercules/auth-tanstack";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/sign-in")({
  server: {
    handlers: {
      // `maxAge: 0` makes the provider ask for credentials on every sign-in
      // instead of silently reusing an existing single-sign-on session (for
      // example, the builder's session from the dev preview).
      GET: handleSignInRoute({ maxAge: 0 }),
    },
  },
});
