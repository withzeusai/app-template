/**
 * The in-app path to return to after sign-in, when it is safe to follow: a
 * same-origin path, and not one of the auth routes themselves.
 */
export function resolveReturnTo(returnTo: string | null): string {
  if (returnTo === null || !returnTo.startsWith("/")) return "/";
  if (returnTo.startsWith("//") || returnTo.startsWith("/\\")) return "/";
  if (returnTo.startsWith("/auth/")) return "/";
  return returnTo;
}
