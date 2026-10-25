import { handleSignInRoute } from "@usehercules/auth-tanstack";
import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://app.invalid";

/** The same-origin path to return to after sign-in, never an auth route. */
function resolveReturnTo(returnTo: string | null): string {
  if (returnTo === null || !returnTo.startsWith("/")) return "/";
  let url: URL;
  try {
    // Parsed the way a browser reads `Location`, so `/\t/evil.com` is caught.
    url = new URL(returnTo, BASE);
  } catch {
    return "/";
  }
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (url.origin !== BASE || path.startsWith("//")) return "/";
  if (path.toLowerCase().startsWith("/auth/")) return "/";
  return path;
}

export const Route = createFileRoute("/auth/sign-in")({
  server: {
    handlers: {
      // `maxAge: 0` in dev makes the preview ask for credentials every time.
      GET: ({ request }) =>
        handleSignInRoute({
          maxAge: import.meta.env.DEV ? 0 : undefined,
          returnPathname: resolveReturnTo(
            new URL(request.url).searchParams.get("returnTo"),
          ),
        })({ request }),
      ANY: () =>
        new Response(null, { status: 405, headers: { allow: "GET, HEAD" } }),
    },
  },
});
