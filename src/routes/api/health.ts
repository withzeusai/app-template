import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

/**
 * Example server route: `GET /api/health` returns JSON.
 *
 * Server routes live in `src/routes/` like page routes, but declare
 * `server.handlers` instead of a `component`. Each handler receives
 * `{ request, params }` and returns a `Response`; `json()` sets the
 * `Content-Type` for you. Add `POST`, `PUT`, `DELETE`, ... next to `GET` as
 * needed.
 *
 * File naming: a dot in a route file name is a path separator, so
 * `products.json.ts` would serve `/api/products/json`. Escape a literal dot
 * with `[.]`: `products[.]json.ts` -> `/api/products.json`.
 *
 * To read Convex data here, use `publicConvexClient()` or
 * `authenticatedConvexClient()` from `@/lib/convex-server.ts`.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => json({ status: "ok", time: new Date().toISOString() }),
    },
  },
});
