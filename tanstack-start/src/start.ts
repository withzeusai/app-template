import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { herculesAuthMiddleware } from "@usehercules/auth-tanstack";

// Keep `csrfMiddleware`: setting `requestMiddleware` replaces Start's default
// CSRF check, and the session cookie is `SameSite=None` for the preview
// iframe. It only checks server functions, so the provider's redirect back to
// `/auth/callback` still works. `HERCULES_AUTH_REDIRECT_URI` is the public
// callback URL behind the proxy; unset, the SDK uses `request.url`.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    herculesAuthMiddleware({
      redirectUri: process.env.HERCULES_AUTH_REDIRECT_URI,
    }),
  ],
}));
