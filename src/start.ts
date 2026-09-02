import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { herculesAuthMiddleware } from "@usehercules/auth-tanstack";
import { withResponseCacheSafety } from "./lib/response-cache";

/**
 * Server-side TanStack Start configuration.
 *
 * `herculesAuthMiddleware` applies the auth SDK's configuration to every
 * sign-in, callback, and session cookie. It matters for this template because
 * the app runs behind a TLS-terminating proxy (Cloudflare Workers, plus
 * Hercules deploy/preview infrastructure) and is embedded cross-site in an
 * iframe:
 *
 *   - `redirectUri` — the public callback URL. Behind the proxy, `request.url`
 *     only reflects the internal `http://` hop, so without this the session
 *     cookie would be written without `Secure` and `redirect_uri` would be
 *     built from the wrong origin. Set `HERCULES_AUTH_REDIRECT_URI` (e.g.
 *     `https://your-app.example.com/auth/callback`) in deployed environments.
 *     When unset — as in local dev — the SDK falls back to `request.url`.
 *
 * Cookie `SameSite` is intentionally left at the SDK's protocol-derived
 * default: `None` + `Secure` over HTTPS so the cookies survive cross-site
 * iframe embedding, and `Lax` over HTTP for local development.
 *
 * `csrfMiddleware` must stay in this array: supplying any `requestMiddleware`
 * replaces TanStack Start's default CSRF middleware, and the `SameSite=None`
 * session cookie means the browser provides no same-site backstop of its own.
 * It is scoped to server functions so cross-site *navigations* — in
 * particular the OIDC provider's redirect back to `/auth/callback` (a server
 * route) — are unaffected, while cross-site fetches to server-function
 * endpoints are rejected. Same-origin requests from the app itself always
 * pass, including when the app is embedded in an iframe.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Wrap auth and CSRF responses too. The root serializes session state, so an
// opted-in product route must still become private for a cookie-bearing request.
const cacheSafetyMiddleware = createMiddleware().server(
  async ({ request, next, handlerType }) => {
    const result = await next();
    return {
      ...result,
      response: withResponseCacheSafety(
        request,
        result.response,
        handlerType === "serverFn",
      ),
    };
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [
    cacheSafetyMiddleware,
    csrfMiddleware,
    herculesAuthMiddleware({
      redirectUri: process.env.HERCULES_AUTH_REDIRECT_URI,
    }),
  ],
}));
