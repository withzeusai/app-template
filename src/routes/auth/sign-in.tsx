import { handleSignInRoute } from "@usehercules/auth-tanstack"
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/sign-in")({
  server: {
    handlers: {
      GET: handleSignInRoute(),
    },
  },
});
