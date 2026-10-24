import { handleSignInRoute } from "@usehercules/auth-tanstack";
import { createFileRoute } from "@tanstack/react-router";
import { resolveReturnTo } from "@/lib/return-to.ts";

export const Route = createFileRoute("/auth/sign-in")({
  server: {
    handlers: {
      // `maxAge: 0` makes the provider ask for credentials on every sign-in
      // instead of silently reusing an existing single-sign-on session (for
      // example, the builder's session from the dev preview). `returnTo` is
      // the page the sign-in button was on; the callback redirects there.
      GET: ({ request }) =>
        handleSignInRoute({
          maxAge: 0,
          returnPathname: resolveReturnTo(
            new URL(request.url).searchParams.get("returnTo"),
          ),
        })({ request }),
    },
  },
});
