import { AUTH_ERROR_PARAM } from "@usehercules/auth-tanstack";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  sign_in_expired: "That sign-in expired. Please sign in again.",
};

const FALLBACK_MESSAGE = "Sign-in didn't complete. Please try again.";

export type AuthError = {
  /** What to tell the user. */
  message: string;
  /** The same URL without the parameter, as path, query, and hash. */
  cleanPath: string;
};

/**
 * Reads the `?auth_error=` reason that `/auth/callback` adds when it sends a
 * failed sign-in back into the app. Returns `null` when the URL has none.
 */
export function readAuthError(href: string): AuthError | null {
  const url = new URL(href);
  const reason = url.searchParams.get(AUTH_ERROR_PARAM);
  if (reason === null) return null;
  url.searchParams.delete(AUTH_ERROR_PARAM);
  return {
    message: AUTH_ERROR_MESSAGES[reason] ?? FALLBACK_MESSAGE,
    cleanPath: url.pathname + url.search + url.hash,
  };
}
