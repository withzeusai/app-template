import { handleSignInRoute } from "@usehercules/auth-tanstack";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Scopes requested from Hercules Auth. The SDK default (`openid profile
 * email`) omits `offline_access`, and without it no refresh token is issued:
 * the session can never be renewed, and the client-side token refresh that
 * Convex triggers right after sign-in comes back empty.
 */
const SIGN_IN_SCOPE = "openid profile email offline_access";

export const Route = createFileRoute("/auth/sign-in")({
  server: {
    handlers: {
      GET: handleSignInRoute({ scope: SIGN_IN_SCOPE }),
    },
  },
});
