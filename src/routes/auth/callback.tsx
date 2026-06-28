import { handleCallbackRoute } from "@usehercules/auth-tanstack"
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute(),
    },
  },
});
