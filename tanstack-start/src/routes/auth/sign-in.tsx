import { handleSignInRoute } from "@usehercules/auth-tanstack";
import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "@/lib/method-not-allowed.ts";
import { resolveReturnTo } from "@/lib/return-to.ts";

export const Route = createFileRoute("/auth/sign-in")({
  server: {
    handlers: {
      // In development, which is what the Hercules preview runs, `maxAge: 0`
      // makes the provider ask for credentials on every sign-in instead of
      // silently reusing its single-sign-on session, so the builder can try
      // the preview as different users. Deployed apps let the provider reuse
      // the session, as single sign-on normally works. `returnTo` is the page
      // the sign-in button was on; the callback redirects there. HEAD falls
      // back to GET.
      GET: ({ request }) =>
        handleSignInRoute({
          maxAge: import.meta.env.DEV ? 0 : undefined,
          returnPathname: resolveReturnTo(
            new URL(request.url).searchParams.get("returnTo"),
          ),
        })({ request }),
      ANY: methodNotAllowed,
    },
  },
});
