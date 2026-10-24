/**
 * 405 for a method a server route does not handle. Without an `ANY` handler
 * that returns it, TanStack Start renders the app for those methods with a
 * 200, so `POST /auth/sign-in` would answer with a page.
 */
export function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
}
