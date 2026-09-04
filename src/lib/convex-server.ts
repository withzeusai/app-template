import { ConvexHttpClient } from "convex/browser";
import { getIdTokenAction } from "@usehercules/auth-tanstack";

/**
 * Server-only Convex clients for code that runs outside the router: server
 * route handlers (`src/routes/api/*`, `server.handlers`) and `createServerFn`
 * handlers.
 *
 * Route loaders and `beforeLoad` during SSR should NOT use these. They already
 * have `context.convexQueryClient.serverHttpClient`, which `__root.tsx`
 * authenticates once per request, and queries made through
 * `ensureQueryData(convexQuery(...))` are dehydrated into the HTML and reused
 * by the client. Server routes and server functions run outside that router
 * context, so they need their own client — which is what these helpers build.
 *
 * The client is `ConvexHttpClient` from `convex/browser`: a stateless HTTP
 * client that works in Node and on Cloudflare Workers. A fresh instance is
 * created per call so one request's auth never leaks into another.
 */

function convexUrl(): string {
  // Statically inlined by Vite into both the client and the worker bundle, so
  // this is the same value `src/router.tsx` uses.
  const url = import.meta.env.VITE_CONVEX_URL;
  if (!url) {
    throw new Error(
      "VITE_CONVEX_URL is not set — the server-side Convex client cannot connect.",
    );
  }
  return url;
}

/**
 * A fresh, unauthenticated Convex HTTP client.
 *
 * Use for public data in server route handlers and server functions, e.g. a
 * JSON endpoint that lists products. Every Convex function you call with it
 * sees `ctx.auth.getUserIdentity()` as `null`.
 *
 * @example
 * ```ts
 * // src/routes/api/products[.]json.ts  ->  GET /api/products.json
 * const products = await publicConvexClient().query(api.products.list, {});
 * return json(products);
 * ```
 */
export function publicConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(convexUrl());
}

/**
 * A fresh Convex HTTP client authenticated as the current visitor, when they
 * have a Hercules session.
 *
 * Reads the ID token from the sealed session cookie via `getIdTokenAction`
 * (a server function, so this must be called on the server: inside a server
 * route handler or a `createServerFn` handler). When the visitor is signed
 * out no token exists and the client is returned unauthenticated — Convex
 * functions then see `ctx.auth.getUserIdentity()` as `null`, so they must
 * still handle the signed-out case.
 *
 * The token stays on the server. Never return it — or anything derived from
 * it — to the browser; return only the Convex result.
 *
 * @example
 * ```ts
 * export const getWishlistCount = createServerFn({ method: "GET" }).handler(
 *   async () => {
 *     const client = await authenticatedConvexClient();
 *     return client.query(api.wishlist.count, {});
 *   },
 * );
 * ```
 */
export async function authenticatedConvexClient(): Promise<ConvexHttpClient> {
  const client = publicConvexClient();
  const idToken = await getIdTokenAction();
  if (idToken) {
    client.setAuth(idToken);
  }
  return client;
}
