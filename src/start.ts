import { createStart } from "@tanstack/react-start";
import { herculesAuthMiddleware } from "@usehercules/auth-tanstack";

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
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [
    herculesAuthMiddleware({
      redirectUri: process.env.HERCULES_AUTH_REDIRECT_URI,
    }),
  ],
}));
